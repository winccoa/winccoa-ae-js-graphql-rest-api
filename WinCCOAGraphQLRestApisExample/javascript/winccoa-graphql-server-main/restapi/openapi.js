// OpenAPI specification for WinCC OA REST API
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')

// Load the full OpenAPI spec from YAML file
const yamlPath = path.join(__dirname, 'openapi-full.yaml')
const yamlContent = fs.readFileSync(yamlPath, 'utf8')
const swaggerSpec = yaml.load(yamlContent)

module.exports = swaggerSpec

/* Old JS-based spec - replaced with YAML
const swaggerJsdoc = require('swagger-jsdoc')

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WinCC OA REST API',
      version: '1.0.0',
      description: 'REST API for WinCC OA GraphQL Server - provides HTTP endpoints for all WinCC OA operations including data point management, alerting, CNS, and system operations.',
      contact: {
        name: 'API Support',
        url: 'https://github.com/siemens/winccoa'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtained from /restapi/auth/login'
        }
      },
      schemas: {
        LoginRequest: {
          type: 'object',
          required: ['username', 'password'],
          properties: {
            username: {
              type: 'string',
              description: 'Username for authentication'
            },
            password: {
              type: 'string',
              format: 'password',
              description: 'Password for authentication'
            }
          }
        },
        LoginResponse: {
          type: 'object',
          properties: {
            token: {
              type: 'string',
              description: 'JWT authentication token'
            },
            expiresAt: {
              type: 'string',
              format: 'date-time',
              description: 'Token expiration timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error type'
            },
            message: {
              type: 'string',
              description: 'Detailed error message'
            }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              description: 'Operation success status'
            }
          }
        },
        ElementType: {
          type: 'string',
          enum: [
            'BOOL', 'UINT8', 'INT32', 'INT64', 'FLOAT', 'DOUBLE',
            'BIT', 'BIT32', 'BIT64', 'STRING', 'TIME', 'DPID',
            'LANGSTRING', 'BLOB', 'MIXED',
            'DYN_BOOL', 'DYN_UINT8', 'DYN_INT32', 'DYN_INT64',
            'DYN_FLOAT', 'DYN_DOUBLE', 'DYN_BIT', 'DYN_BIT32',
            'DYN_BIT64', 'DYN_STRING', 'DYN_TIME', 'DYN_DPID',
            'DYN_LANGSTRING', 'DYN_BLOB'
          ]
        },
        CtrlType: {
          type: 'string',
          enum: [
            'TIME_VAR', 'BOOL_VAR', 'INT_VAR', 'UINT_VAR', 'FLOAT_VAR',
            'STRING_VAR', 'BIT32_VAR', 'CHAR_VAR', 'DYN_TIME_VAR',
            'DYN_BOOL_VAR', 'DYN_INT_VAR', 'DYN_UINT_VAR', 'DYN_FLOAT_VAR',
            'DYN_STRING_VAR', 'DYN_BIT32_VAR', 'DYN_CHAR_VAR',
            'ATIME_VAR', 'LANGSTRING_VAR', 'BLOB_VAR', 'LONG_VAR',
            'ULONG_VAR', 'BIT64_VAR'
          ]
        },
        DpTypeNode: {
          type: 'object',
          required: ['name', 'type'],
          properties: {
            name: {
              type: 'string',
              description: 'Node name'
            },
            type: {
              $ref: '#/components/schemas/ElementType'
            },
            refName: {
              type: 'string',
              description: 'Reference type name'
            },
            children: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/DpTypeNode'
              }
            },
            newName: {
              type: 'string',
              description: 'New name for the node'
            }
          }
        },
        Tag: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Tag name'
            },
            value: {
              description: 'Current tag value'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            },
            status: {
              type: 'object',
              description: 'Tag status information'
            }
          }
        },
        AlertTime: {
          type: 'object',
          required: ['time', 'count', 'dpe'],
          properties: {
            time: {
              type: 'string',
              format: 'date-time',
              description: 'Alert timestamp'
            },
            count: {
              type: 'integer',
              description: 'Alert count'
            },
            dpe: {
              type: 'string',
              description: 'Data point element'
            }
          }
        },
        CnsTreeNode: {
          type: 'object',
          required: ['name', 'displayName'],
          properties: {
            name: {
              type: 'string',
              description: 'Node ID'
            },
            displayName: {
              type: 'object',
              description: 'Multi-language display name'
            },
            dp: {
              type: 'string',
              description: 'Linked data point element'
            },
            children: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/CnsTreeNode'
              }
            }
          }
        }
      }
    },
    tags: [
      {
        name: 'Authentication',
        description: 'Authentication endpoints'
      },
      {
        name: 'Data Points',
        description: 'Data point operations (CRUD and value management)'
      },
      {
        name: 'Data Point Types',
        description: 'Data point type management'
      },
      {
        name: 'Tags',
        description: 'Tag queries with metadata'
      },
      {
        name: 'Alerts',
        description: 'Alert handling operations'
      },
      {
        name: 'CNS',
        description: 'Central Navigation Service operations'
      },
      {
        name: 'System',
        description: 'System information and redundancy'
      },
      {
        name: 'Extras',
        description: 'Additional operations (OPC UA, etc.)'
      }
    ],
    paths: {
      '/restapi/auth/login': {
        post: {
          tags: ['Authentication'],
          summary: 'Login to get JWT token',
          description: 'Authenticate with username and password to receive a JWT token for subsequent requests',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/LoginRequest'
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Successful authentication',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/LoginResponse'
                  }
                }
              }
            },
            401: {
              description: 'Invalid credentials',
              content: {
                'application/json': {
                  schema: {
                    $ref: '#/components/schemas/Error'
                  }
                }
              }
            }
          }
        }
      },
      '/restapi/health': {
        get: {
          tags: ['System'],
          summary: 'Health check',
          description: 'Check API health status (no authentication required)',
          responses: {
            200: {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      status: {
                        type: 'string',
                        example: 'healthy'
                      },
                      service: {
                        type: 'string',
                        example: 'WinCC OA REST API'
                      },
                      uptime: {
                        type: 'number',
                        description: 'Server uptime in seconds'
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/restapi/datapoints': {
        get: {
          tags: ['Data Points'],
          summary: 'List data points',
          description: 'Search for data points by pattern',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'pattern',
              in: 'query',
              schema: { type: 'string' },
              description: 'Search pattern (wildcards supported)'
            },
            {
              name: 'dpType',
              in: 'query',
              schema: { type: 'string' },
              description: 'Filter by data point type'
            },
            {
              name: 'ignoreCase',
              in: 'query',
              schema: { type: 'boolean' },
              description: 'Case-insensitive search'
            }
          ],
          responses: {
            200: {
              description: 'List of data points',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      datapoints: {
                        type: 'array',
                        items: { type: 'string' }
                      }
                    }
                  }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' }
          }
        },
        post: {
          tags: ['Data Points'],
          summary: 'Create data point',
          description: 'Create a new data point (Admin only)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['dpeName', 'dpType'],
                  properties: {
                    dpeName: { type: 'string', description: 'Data point name' },
                    dpType: { type: 'string', description: 'Data point type' },
                    systemId: { type: 'integer', description: 'System ID (optional)' },
                    dpId: { type: 'integer', description: 'Specific DP ID (optional)' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Data point created',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' }
          }
        }
      },
      '/restapi/datapoints/{dpeName}/value': {
        get: {
          tags: ['Data Points'],
          summary: 'Get data point value',
          description: 'Retrieve current value of a data point element',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'dpeName',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Data point element name (URL encoded)'
            }
          ],
          responses: {
            200: {
              description: 'Current value',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      value: { description: 'Current value (any type)' }
                    }
                  }
                }
              }
            }
          }
        },
        put: {
          tags: ['Data Points'],
          summary: 'Set data point value',
          description: 'Set the value of a data point element (Admin only)',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'dpeName',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Data point element name (URL encoded)'
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['value'],
                  properties: {
                    value: { description: 'New value (any type)' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'Value set successfully',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' }
          }
        }
      },
      '/restapi/system/version': {
        get: {
          tags: ['System'],
          summary: 'Get version information',
          description: 'Get WinCC OA and API version information',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Version information',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      api: {
                        type: 'object',
                        properties: {
                          version: { type: 'integer' }
                        }
                      },
                      winccoa: {
                        type: 'object',
                        properties: {
                          display: { type: 'string' },
                          major: { type: 'integer' },
                          minor: { type: 'integer' },
                          numeric: { type: 'integer' },
                          numeric_full: { type: 'integer' },
                          patch: { type: 'integer' },
                          platform: { type: 'string' },
                          revision: { type: 'integer' },
                          version: { type: 'string' }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/restapi/tags': {
        get: {
          tags: ['Tags'],
          summary: 'Get tags',
          description: 'Get multiple tags with value, timestamp, and status',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'dpeNames',
              in: 'query',
              required: true,
              schema: { type: 'string' },
              description: 'Comma-separated list of data point element names'
            }
          ],
          responses: {
            200: {
              description: 'Tags retrieved',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      tags: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Tag' }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
      '/restapi/extras/opcua/address': {
        post: {
          tags: ['Extras'],
          summary: 'Set OPC UA address',
          description: 'Configure OPC UA address for a data point (Admin only)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: [
                    'datapointName', 'driverNumber', 'addressDirection',
                    'addressDataType', 'serverName', 'subscriptionName', 'nodeId'
                  ],
                  properties: {
                    datapointName: { type: 'string', description: 'Data point name' },
                    driverNumber: { type: 'integer', description: 'OPC UA driver number' },
                    addressDirection: { type: 'integer', description: 'Address direction (input/output)' },
                    addressDataType: { type: 'integer', description: 'Data type code' },
                    serverName: { type: 'string', description: 'OPC UA server name' },
                    subscriptionName: { type: 'string', description: 'Subscription name' },
                    nodeId: { type: 'string', description: 'OPC UA node ID' }
                  }
                }
              }
            }
          },
          responses: {
            200: {
              description: 'OPC UA address configured',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/SuccessResponse' }
                }
              }
            },
            401: { $ref: '#/components/responses/Unauthorized' },
            403: { $ref: '#/components/responses/Forbidden' }
          }
        }
      }
    },
    components: {
      responses: {
        Unauthorized: {
          description: 'Authentication required or token invalid',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        },
        Forbidden: {
          description: 'Insufficient permissions (admin role required)',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/Error' }
            }
          }
        }
      }
    }
  },
  apis: [] // We define the spec manually above
}

const swaggerSpec = swaggerJsdoc(options)

module.exports = swaggerSpec */
