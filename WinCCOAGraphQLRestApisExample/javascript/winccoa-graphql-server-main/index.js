// Load environment variables from .env file in the script's directory
const scriptDir = __dirname;
const envPath = require('path').join(scriptDir, '.env');

console.log(`Looking for .env file at: ${envPath}`);

const dotenvResult = require('dotenv').config({ path: envPath });

// Log dotenv loading result
if (dotenvResult.error) {
  console.log('⚠️  .env file not found or could not be loaded:', dotenvResult.error.message);
  console.log('   Using environment variables and defaults');
} else {
  console.log('✅ .env file loaded successfully');
  console.log('   Loaded variables:', Object.keys(dotenvResult.parsed || {}).join(', '));
}

// Check for debug flag
const DEBUG_WINCCOA = process.argv.includes('--debug');
if (DEBUG_WINCCOA) {
  console.log('🐛 Debug mode enabled: All WinCC OA Node.js function calls will be logged');
}

// Require WinCC OA interface — ONE global instance used only for DISABLE_AUTH / static token paths
const { WinccoaManager } = require('winccoa-manager');
const winccoaBase = new WinccoaManager();

// Wrap WinCC OA manager to log all function calls if debug is enabled
const winccoa = new Proxy(winccoaBase, {
  get(target, prop) {
    const value = target[prop];
    if (typeof value === 'function' && DEBUG_WINCCOA) {
      return function(...args) {
        console.log(`[WINCCOA] ${prop}(${args.map(a => JSON.stringify(a)).join(', ')})`);
        const result = value.apply(target, args);
        if (result instanceof Promise) {
          return result.then(res => {
            console.log(`[WINCCOA] ${prop} => ${JSON.stringify(res)}`);
            return res;
          }).catch(err => {
            console.log(`[WINCCOA] ${prop} => ERROR: ${err.message}`);
            throw err;
          });
        }
        console.log(`[WINCCOA] ${prop} => ${JSON.stringify(result)}`);
        return result;
      };
    }
    return value;
  }
});

// Import V1 resolver modules (now in graphql)
const { createCommonResolvers } = require('./graphql/common');
const { createAlertOperationResolvers } = require('./graphql/alerting');
const { createSubscriptionResolvers } = require('./graphql/subscriptions');
const { createCnsOperationResolvers } = require('./graphql/cns');
const { createExtrasResolvers } = require('./graphql/extras');

// Import V2 resolvers
const { createV2Resolvers } = require('./graphql/resolvers');

// Import custom scalars
const { AnytypeScalar } = require('./graphql/scalars');

// Import REST API
const { createRestApi } = require('./restapi/rest-api');

// Import Swagger
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./restapi/openapi');

// Import usage tracker
const { UsageTracker } = require('./usage-tracker');

// Import extracted lib modules
const { createLogger } = require('./lib/logger');
const {
  generateToken,
  validateToken,
  authenticateUser,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  READONLY_USERNAME,
  READONLY_PASSWORD,
  DIRECT_ACCESS_TOKEN,
  READONLY_TOKEN,
  JWT_SECRET,
  DEFAULT_JWT_SECRET,
  TOKEN_EXPIRY_MS,
  AUTH_MODE,
  ALLOW_DEV_LOGIN,
  tokenStore
} = require('./lib/auth');
const { SimplePubSub } = require('./lib/pubsub');
const { createSessionManager } = require('./lib/session-manager');

// Import required modules
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@as-integrations/express5');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const { makeExecutableSchema } = require('@graphql-tools/schema');
const { WebSocketServer } = require('ws');
const { makeServer, handleProtocols } = require('graphql-ws');
const express = require('express');
const http = require('http');
const { join } = require('path');
const cors = require('cors');

// Parse command line arguments
const args = process.argv.slice(2);
const noAuthArg = args.includes('--no-auth');

// Configuration
const PORT = process.env.GRAPHQL_PORT || 4000;
const HOST = process.env.GRAPHQL_HOST || '0.0.0.0';
const DISABLE_AUTH = noAuthArg || process.env.DISABLE_AUTH === 'true';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';

// Create logger (from lib/logger.js)
const logger = createLogger();

// Create usage tracker instance
const usageTracker = new UsageTracker(logger);

// Log startup configuration
console.log(`Starting GraphQL server on ${HOST}:${PORT} with DISABLE_AUTH=${DISABLE_AUTH}`);
console.log(`🌐 CORS Configuration: ${CORS_ORIGIN}`);
console.log('🔐 Authentication Configuration:');
console.log(`   Admin Username: ${ADMIN_USERNAME ? '✅ Set' : '❌ Not set'}`);
console.log(`   Admin Password: ${ADMIN_PASSWORD ? '✅ Set' : '❌ Not set'}`);
console.log(`   Direct Access Token: ${DIRECT_ACCESS_TOKEN ? '✅ Set' : '❌ Not set'}`);
console.log(`   Readonly Username: ${READONLY_USERNAME ? '✅ Set' : '❌ Not set'}`);
console.log(`   Readonly Token: ${READONLY_TOKEN ? '✅ Set' : '❌ Not set'}`);
console.log(`   JWT Secret: ${JWT_SECRET !== DEFAULT_JWT_SECRET ? '✅ Custom' : '⚠️  Default (change in production)'}`);
console.log(`   Token Expiry / Idle Timeout: ${TOKEN_EXPIRY_MS}ms (${Math.round(TOKEN_EXPIRY_MS / 60000)} minutes)`);
console.log(`   Auth Mode: ${AUTH_MODE} (config=env-var only, winccoa=WinCC OA users, both=env-var then WinCC OA)`);
console.log(`   Dev Login: ${ALLOW_DEV_LOGIN ? '✅ Explicitly enabled' : '❌ Disabled'}`);

if (DISABLE_AUTH) {
  console.log('⚠️  WARNING: Authentication is DISABLED! This is unsafe for production.');
} else if (!ADMIN_USERNAME && !READONLY_USERNAME && !DIRECT_ACCESS_TOKEN && !READONLY_TOKEN) {
  console.log('⚠️  WARNING: No authentication credentials configured!');
} else {
  console.log('✅ Authentication is properly configured.');
}

if (!DISABLE_AUTH && process.env.NODE_ENV === 'production') {
  if (JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error('Refusing to start in production with the default JWT_SECRET')
  }

  const hasConfiguredCredential =
    (ADMIN_USERNAME && ADMIN_PASSWORD) ||
    (READONLY_USERNAME && READONLY_PASSWORD) ||
    DIRECT_ACCESS_TOKEN ||
    READONLY_TOKEN
  const requiresConfiguredCredential = AUTH_MODE === 'config'
  if (requiresConfiguredCredential && !hasConfiguredCredential) {
    throw new Error('Refusing to start in production with AUTH_MODE=config and no configured credentials')
  }
}

// Load GraphQL schema
const schemaV2 = require('./graphql');
const typeDefs = schemaV2.typeDefs;

// Wrap validateToken / authenticateUser to bind the logger (lib/auth exports take logger as param).
// authenticateUser uses AUTH_MODE internally — no winccoa instance needed here.
const _validateToken    = (token) => validateToken(token, logger);
const _authenticateUser = (username, password) => authenticateUser(username, password, logger);

/**
 * Merges multiple GraphQL resolver objects into a single resolver.
 *
 * @param {...object} resolverObjects - Variable number of resolver objects to merge
 * @returns {object} Merged resolver object
 */
function mergeResolvers(...resolverObjects) {
  const merged = {};

  for (const resolverObj of resolverObjects) {
    for (const [key, value] of Object.entries(resolverObj)) {
      if (!merged[key]) {
        merged[key] = {};
      }
      if (typeof value === 'object' && value !== null) {
        Object.assign(merged[key], value);
      } else {
        merged[key] = value;
      }
    }
  }

  return merged;
}

// Build the global resolver set used only when auth is disabled or for static tokens.
// For normal authenticated sessions, each session has its own resolver set (see SessionManager).
const globalCommonResolvers  = createCommonResolvers(winccoa, logger);
const globalAlertResolvers   = createAlertOperationResolvers(winccoa);
const globalSubResolvers     = createSubscriptionResolvers(winccoa, logger);
const globalCnsResolvers     = createCnsOperationResolvers(winccoa);
const globalExtrasResolvers  = createExtrasResolvers(winccoa, logger);

const globalOldResolvers = mergeResolvers(
  globalCommonResolvers,
  globalAlertResolvers,
  globalSubResolvers,
  globalCnsResolvers,
  globalExtrasResolvers
);

const globalV2Resolvers = createV2Resolvers(winccoa, logger, globalOldResolvers);

// Session manager — one WinccoaManager per authenticated session
const sessionManager = createSessionManager({
  logger,
  debugWinccoa: DEBUG_WINCCOA,
  tokenStore,
  idleTimeoutMs: TOKEN_EXPIRY_MS,
  mergeResolvers
});

/**
 * Returns the winccoa instance and resolver sets for the given auth context.
 *
 * - DISABLE_AUTH / no-auth → global instance
 * - Static bypass token    → global instance (no session entry exists)
 * - Normal JWT session     → per-session instance from SessionManager
 *
 * @param {object|null} user  - result of _validateToken (has tokenId)
 * @returns {{ winccoa, oldResolvers, v2Resolvers }}
 */
function getSessionResources(user) {
  if (!user) {
    return { winccoa, oldResolvers: globalOldResolvers, v2Resolvers: globalV2Resolvers };
  }

  // Static tokens use the global instance
  const isStaticToken = user.tokenId === 'direct' || user.tokenId === 'readonly' || user.tokenId === 'no-auth';
  if (isStaticToken || DISABLE_AUTH) {
    return { winccoa, oldResolvers: globalOldResolvers, v2Resolvers: globalV2Resolvers };
  }

  const session = sessionManager.getSession(user.tokenId);
  if (session) {
    return { winccoa: session.winccoa, oldResolvers: session.oldResolvers, v2Resolvers: session.v2Resolvers };
  }

  logger.warn(`getSessionResources: no session found for tokenId=${user.tokenId.substring(0, 8)}... — rejecting request`);
  throw new Error('Unauthorized');
}

/**
 * Builds a resolver map where every resolver function delegates to the
 * per-request resolver stored in contextValue.
 *
 * For each type (Query, Mutation, etc.) and each field, the returned function:
 * 1. Looks up the matching resolver in contextValue.v2Resolvers (per-session)
 * 2. Falls back to the provided globalResolvers if none found
 * 3. Calls the found resolver with the same arguments
 *
 * This allows the Apollo schema to remain static while the actual WinCC OA
 * calls go through the per-session WinccoaManager.
 */
function buildContextAwareResolvers(globalResolvers) {
  const result = {};

  function getSessionFieldResolver(typeName, fieldName, fallback, contextValue) {
    if (contextValue && contextValue.v2Resolvers) {
      const sessionType = contextValue.v2Resolvers[typeName];
      if (sessionType && sessionType[fieldName]) {
        return sessionType[fieldName];
      }
    }
    return fallback;
  }

  for (const [typeName, typeResolvers] of Object.entries(globalResolvers)) {
    // Skip scalar types and non-object entries
    if (typeof typeResolvers !== 'object' || typeResolvers === null) {
      result[typeName] = typeResolvers;
      continue;
    }

    result[typeName] = {};

    for (const [fieldName, fieldResolver] of Object.entries(typeResolvers)) {
      if (fieldResolver && typeof fieldResolver === 'object') {
        const wrappedResolver = { ...fieldResolver };

        for (const resolverMethod of ['subscribe', 'resolve']) {
          if (typeof fieldResolver[resolverMethod] !== 'function') continue;

          wrappedResolver[resolverMethod] = function(parent, args, contextValue, info) {
            const sessionField = getSessionFieldResolver(typeName, fieldName, fieldResolver, contextValue);
            const resolver = sessionField && typeof sessionField[resolverMethod] === 'function'
              ? sessionField[resolverMethod]
              : fieldResolver[resolverMethod];

            return resolver(parent, args, contextValue, info);
          };
        }

        result[typeName][fieldName] = wrappedResolver;
        continue;
      }

      if (typeof fieldResolver !== 'function') {
        result[typeName][fieldName] = fieldResolver;
        continue;
      }

      // Wrap: look up the per-session resolver from context, fall back to global
      result[typeName][fieldName] = function(parent, args, contextValue, info) {
        const sessionField = getSessionFieldResolver(typeName, fieldName, fieldResolver, contextValue);
        const resolver = typeof sessionField === 'function' ? sessionField : fieldResolver;

        return resolver(parent, args, contextValue, info);
      };
    }
  }

  return result;
}

// GraphQL Resolvers — build the top-level resolver map using a dynamic dispatch
// approach: the actual winccoa/resolvers are looked up per-request from context.
//
// For v2 resolvers we need a static schema-level resolver object, but the actual
// data work happens inside resolver functions that read from contextValue.
//
// Strategy: the v2Resolvers object is built from globalV2Resolvers for schema
// registration, but every leaf resolver that actually calls winccoa reads the
// per-session instance from context. This is done by replacing Query/Mutation
// resolver functions with context-aware wrappers.
//
// In practice, because all V2 resolvers ultimately call winccoa through their
// closure, and the per-session winccoa is attached to contextValue.winccoa,
// we need a different approach: build a thin schema resolver set that delegates
// to context.resolvers.
//
// We use a Proxy-based approach on the schema resolvers to forward calls to
// the per-request resolver set stored in context.
const resolvers = mergeResolvers(
  // Top-level resolvers that delegate to context.v2Resolvers at request time
  buildContextAwareResolvers(globalV2Resolvers),
  {
    Anytype: AnytypeScalar,
    Mutation: {
      async login(_, { username, password }) {
        const user = _authenticateUser(username, password);

        if (!user) {
          throw new Error('Invalid username or password');
        }

        const { token, expiresAt, tokenId } = generateToken(user.id, user.role);

        // Create a per-session WinccoaManager (unless auth is disabled)
        if (!DISABLE_AUTH) {
          sessionManager.createSession(tokenId, user.role);
        }

        logger.info(`User ${username} logged in successfully with role: ${user.role}`);

        return {
          token,
          expiresAt: new Date(expiresAt).toISOString()
        };
      },

      async logout(_, __, contextValue) {
        const user = contextValue.user;
        if (!user || !user.tokenId) return false;

        const isStaticToken = user.tokenId === 'direct' || user.tokenId === 'readonly' || user.tokenId === 'no-auth';
        if (!isStaticToken) {
          sessionManager.destroySession(user.tokenId);
          logger.info(`User ${user.userId} logged out — session destroyed`);
        }
        return true;
      }
    }
  }
);

// Create executable schema
const schema = makeExecutableSchema({
  typeDefs,
  resolvers
});

// Authentication middleware
const authMiddleware = (req) => {
  // Skip authentication if DISABLE_AUTH is true
  if (DISABLE_AUTH) {
    logger.debug('Authentication disabled, allowing anonymous access');
    return { userId: 'anonymous', tokenId: 'no-auth', role: 'admin' };
  }
  
  const authHeader = req.headers.authorization || req.headers.Authorization;
  
  if (!authHeader) {
    logger.debug('No Authorization header found');
    return null;
  }
  
  if (!authHeader.startsWith('Bearer ')) {
    logger.debug('Authorization header does not start with "Bearer "');
    return null;
  }
  
  const token = authHeader.substring(7);
  logger.debug(`Extracted token from Authorization header: ${token.substring(0, 20)}...`);
  
  const result = _validateToken(token);
  logger.debug(`Token validation result: ${result ? 'valid' : 'invalid'}`);
  return result;
};

function collectRootFieldNames(selectionSet, fragments, names = []) {
  const selections = selectionSet?.selections || [];

  for (const selection of selections) {
    if (selection.kind === 'Field') {
      names.push(selection.name.value);
    } else if (selection.kind === 'InlineFragment') {
      collectRootFieldNames(selection.selectionSet, fragments, names);
    } else if (selection.kind === 'FragmentSpread') {
      const fragment = fragments.get(selection.name.value);
      if (fragment) collectRootFieldNames(fragment.selectionSet, fragments, names);
    }
  }

  return names;
}

// WebSocket authentication
const wsAuthMiddleware = (ctx) => {
  // Skip authentication if DISABLE_AUTH is true
  if (DISABLE_AUTH) {
    logger.debug('WebSocket auth disabled, allowing anonymous access');
    return { user: { userId: 'anonymous', tokenId: 'no-auth', role: 'admin' } };
  }

  const token = ctx.connectionParams?.Authorization;

  if (!token) {
    logger.warn('WebSocket connection missing authorization token');
    throw new Error('Missing authorization token');
  }

  const user = _validateToken(token.replace('Bearer ', ''));

  if (!user) {
    logger.warn('WebSocket connection has invalid or expired token');
    throw new Error('Invalid or expired token');
  }

  return { user };
};

/**
 * Starts the GraphQL server with Express, Apollo, and WebSocket support.
 *
 * Sets up:
 * - REST API endpoints
 * - GraphQL endpoint with authentication
 * - WebSocket subscriptions
 * - Swagger UI documentation
 * - Health check endpoint
 */
async function startServer() {
  try {
    // Create Express app
    const app = express();

    // Trust proxy to get correct protocol/host when behind reverse proxy
    app.set('trust proxy', true);

    const httpServer = http.createServer(app);
    
    // Create WebSocket server in noServer mode to prevent conflict
    // with Express middleware on the same /graphql path.
    // Using { server: httpServer } would cause Node.js to fire both
    // 'request' and 'upgrade' events, letting Express process the
    // upgrade request as HTTP and return 'Unauthorized' before the
    // WebSocket handshake completes.
    const wsServer = new WebSocketServer({ noServer: true });
    
    // Create pub/sub instance
    const pubsub = new SimplePubSub();
    
    const graphqlServer = makeServer({
      schema,
      context: async (ctx) => {
        const authContext = wsAuthMiddleware(ctx);
        const user = authContext.user;
        const { winccoa: sessionWinccoa, oldResolvers, v2Resolvers } = getSessionResources(user);
        return {
          ...authContext,
          winccoa: sessionWinccoa,
          oldResolvers,
          v2Resolvers,
          pubsub
        };
      },
      onConnect: (ctx) => {
        logger.info('WebSocket client connected');
        return true;
      },
      onDisconnect: (ctx, code, reason) => {
        logger.info(`WebSocket client disconnected: code=${code}, reason=${reason}`);
      }
    });

    wsServer.options.handleProtocols = handleProtocols;
    const KEEPALIVE = 12000;

    wsServer.on('connection', (socket, request) => {
      socket.once('error', (err) => {
        console.error('Internal error emitted on a WebSocket socket.', err);
        socket.close(4500, 'Internal server error');
      });

      // Ping/pong keepalive
      let pongWait = null;
      const pingInterval = setInterval(() => {
        if (socket.readyState === socket.OPEN) {
          pongWait = setTimeout(() => socket.terminate(), KEEPALIVE);
          socket.once('pong', () => {
            if (pongWait) { clearTimeout(pongWait); pongWait = null; }
          });
          socket.ping();
        }
      }, KEEPALIVE);

      // We only queue messages behind connection_init. Once it completes, we run freely!
      let initPromise = Promise.resolve();

      const closed = graphqlServer.opened(
        {
          protocol: socket.protocol,
          send: (data) => new Promise((resolve, reject) => {
            if (socket.readyState !== socket.OPEN) return resolve();
            socket.send(data, (err) => (err ? reject(err) : resolve()));
          }),
          close: (code, reason) => socket.close(code, reason),
          onMessage: (cb) => {
            socket.on('message', (event) => {
              const msg = String(event);

              if (msg.includes('"connection_init"')) {
                // Block new messages until connection is fully initialized (ACK sent)
                let resolveInit;
                initPromise = new Promise(r => resolveInit = r);
                
                cb(msg)
                  .catch((err) => {
                    console.error('Error during connection_init handling.', err);
                    socket.close(4400, 'Internal server error');
                  })
                  .finally(() => resolveInit());
              } else {
                // Wait for the initialize block to lift, then run concurrently!
                initPromise.then(() => {
                  cb(msg).catch((err) => {
                    console.error('Error during WebSocket message handling.', err);
                    socket.close(4400, 'Internal server error');
                  });
                });
              }
            });
          }
        },
        { socket, request }
      );

      socket.once('close', (code, reason) => {
        if (pongWait) clearTimeout(pongWait);
        clearInterval(pingInterval);
        closed(code, String(reason));
      });
    });

    const serverCleanup = {
      async dispose() {
        for (const client of wsServer.clients) {
          client.close(1001, 'Going away');
        }
        wsServer.removeAllListeners();
        await new Promise((resolve, reject) => {
          wsServer.close((err) => (err ? reject(err) : resolve()));
        });
      }
    };
    
    // Authentication plugin that checks auth AFTER parsing
    const authPlugin = {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            // Skip auth check if disabled
            if (DISABLE_AUTH) return;
            
            const { request, contextValue, operation, document } = requestContext;
            
            // Check if this is an introspection query
            if (request.operationName === 'IntrospectionQuery') return;
            
            // Parse the root fields so login is exempt only when it is the sole operation.
            let rootFieldNames = [];
            let isLoginOnlyMutation = false;
            let hasMutation = false;
            
            if (operation) {
              // Check operation type
              if (operation.operation === 'mutation') {
                hasMutation = true;
              }

              if (hasMutation) {
                const fragments = new Map();
                for (const definition of document?.definitions || []) {
                  if (definition.kind === 'FragmentDefinition') {
                    fragments.set(definition.name.value, definition);
                  }
                }
                rootFieldNames = collectRootFieldNames(operation.selectionSet, fragments);
                isLoginOnlyMutation = rootFieldNames.length === 1 && rootFieldNames[0] === 'login';
              }
            }
            
            // Skip auth only for a standalone login mutation
            if (isLoginOnlyMutation) return;
            
            // For all other operations, require authentication
            if (!contextValue.user) {
              throw new Error('Unauthorized');
            }
            
            // Check read-only restrictions
            const isLogoutOnlyMutation = rootFieldNames.length === 1 && rootFieldNames[0] === 'logout';
            if (contextValue.user.role === 'readonly' && hasMutation && !isLogoutOnlyMutation) {
              throw new Error('Forbidden: Read-only users cannot perform mutations');
            }
          }
        };
      }
    };
    
    // Usage tracking plugin
    const usageTrackingPlugin = {
      async requestDidStart() {
        return {
          async didResolveOperation(requestContext) {
            const { operationName, operation } = requestContext;

            // Skip introspection queries
            if (operationName === 'IntrospectionQuery') return;

            // Track the operation
            if (operation) {
              const selections = operation.selectionSet?.selections || [];
              for (const selection of selections) {
                if (selection.kind === 'Field') {
                  const fieldName = selection.name.value;
                  const operationType = operation.operation; // query, mutation, subscription
                  usageTracker.track('graphql', `${operationType}/${fieldName}`);
                }
              }
            }
          }
        };
      }
    };

    // Create Apollo Server
    const server = new ApolloServer({
      schema,
      plugins: [
        ApolloServerPluginDrainHttpServer({ httpServer }),
        authPlugin,
        usageTrackingPlugin,
        {
          async serverWillStart() {
            return {
              async drainServer() {
                await serverCleanup.dispose();
              }
            };
          }
        }
      ]
    });
    
    // Start Apollo Server
    await server.start();
    
    // Parse CORS origin configuration
    let corsOptions;
    if (CORS_ORIGIN === '*') {
      corsOptions = { origin: '*' };
    } else {
      // Split by comma and trim whitespace for multiple origins
      const origins = CORS_ORIGIN.split(',').map(origin => origin.trim());
      corsOptions = { origin: origins };
    }
    
    // Apply middleware
    app.use(cors(corsOptions));
    app.use(express.json());

    // Make auth functions, session manager, and usage tracker available to REST API
    app.locals.validateToken     = _validateToken;
    app.locals.authenticateUser  = _authenticateUser;
    app.locals.generateToken     = generateToken;
    app.locals.sessionManager    = sessionManager;
    app.locals.usageTracker      = usageTracker;

    // Apply GraphQL middleware
    app.use(
      '/graphql',
      expressMiddleware(server, {
        context: async ({ req }) => {
          // Always try to authenticate if a token is provided
          const user = authMiddleware(req);

          // Look up per-session resources (winccoa + resolvers)
          const { winccoa: sessionWinccoa, oldResolvers, v2Resolvers } = getSessionResources(user);

          // Return context with user and per-session resources
          return user
            ? { user, winccoa: sessionWinccoa, oldResolvers, v2Resolvers }
            : {};
        }
      })
    );

    // Apply REST API middleware — pass sessionManager and global winccoa (fallback)
    const restApi = createRestApi(winccoa, logger, globalOldResolvers, DISABLE_AUTH, sessionManager);
    app.use('/restapi/v1', restApi);

    // Serve OpenAPI specification
    app.get('/openapi.json', (req, res) => {
      res.setHeader('Content-Type', 'application/json');
      res.send(swaggerSpec);
    });

    // Serve Swagger UI documentation with dynamic server URL
    app.use('/api-docs', swaggerUi.serve);
    app.get('/api-docs', (req, res) => {
      // Don't set server URL on server side - let client-side JS detect it correctly
      swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'WinCC OA REST API Documentation',
        customJs: '/swagger-custom.js'
      })(req, res);
    });

    // Serve static files from public directory
    app.use(express.static(join(__dirname, 'public')));

    // Landing page
    app.get('/', (req, res) => {
      res.sendFile(join(__dirname, 'public', 'index.html'));
    });

    // Health check endpoint
    app.get('/health', (req, res) => {
      res.json({ status: 'healthy', uptime: process.uptime(), activeSessions: sessionManager.sessionCount() });
    });

    // Handle WebSocket upgrades manually so Express doesn't intercept them
    httpServer.on('upgrade', (request, socket, head) => {
      const { pathname } = new URL(request.url, `http://${request.headers.host}`)
      if (pathname === '/graphql') {
        wsServer.handleUpgrade(request, socket, head, (ws) => {
          wsServer.emit('connection', ws, request)
        })
      } else {
        socket.destroy()
      }
    })

    // Start HTTP server
    await new Promise((resolve) => {
      httpServer.listen(PORT, HOST, () => {
        logger.info(`🏭 WinCC OA API Server Started`);
        logger.info(`─────────────────────────────────────────────────`);
        // For display purposes: if listening on 0.0.0.0 (all interfaces), show the hostname; otherwise show configured host
        const displayHost = HOST === '0.0.0.0' ? require('os').hostname() : HOST;
        logger.info(`🏠 Landing page:        http://${displayHost}:${PORT}/`);
        logger.info(`🚀 GraphQL API:         http://${displayHost}:${PORT}/graphql`);
        logger.info(`🔌 WebSocket:           ws://${displayHost}:${PORT}/graphql`);
        logger.info(`🌐 REST API:            http://${displayHost}:${PORT}/restapi`);
        logger.info(`📚 API Documentation:   http://${displayHost}:${PORT}/api-docs`);
        logger.info(`📊 Usage Statistics:    http://${displayHost}:${PORT}/stats.html`);
        logger.info(`📄 OpenAPI Spec:        http://${displayHost}:${PORT}/openapi.json`);
        logger.info(`💚 Health Check:        http://${displayHost}:${PORT}/restapi/health`);
        logger.info(`─────────────────────────────────────────────────`);
        if (DISABLE_AUTH) {
          logger.warn('⚠️  Authentication is DISABLED. Set DISABLE_AUTH=false to enable authentication.');
        }
        logger.info(`⏱️  Session idle timeout: ${TOKEN_EXPIRY_MS / 60000} minutes`);
        resolve();
      });
    });
    
    // Cleanup expired tokens and orphaned sessions periodically
    setInterval(() => {
      // purgeExpiredTokens removes tokens from the store but does not destroy sessions.
      // We do it ourselves here so we can also clean up the WinccoaManager instances.
      const now = Date.now();
      const expiredTokenIds = [];
      for (const [tokenId, data] of tokenStore.entries()) {
        if (now > data.expiresAt) expiredTokenIds.push(tokenId);
      }
      if (expiredTokenIds.length > 0) {
        logger.debug(`Periodic cleanup: removing ${expiredTokenIds.length} expired token(s)`);
        for (const tokenId of expiredTokenIds) {
          sessionManager.destroySession(tokenId);
        }
      }
    }, 60000);
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
const shutdown = () => {
  logger.info('Shutting down gracefully...');
  sessionManager.destroyAll();
  usageTracker.shutdown();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start the server
startServer().catch((error) => {
  logger.error('Server startup failed:', error);
  process.exit(1);
});
