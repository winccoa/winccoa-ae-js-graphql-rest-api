# WinCC OA GraphQL & REST API Server

## Integration and Usage of the WinCC OA GraphQL & REST API Server

## Overview

This application example demonstrates how a SIMATIC WinCC Open Architecture (WinCC OA) system can be extended with a modern API layer using a Node.js-based JavaScript Manager.

The provided solution enables standardized and secure access to WinCC OA data and functionality via:

- A GraphQL API supporting flexible queries and real-time subscriptions
- A REST API providing secure and standardized access to system resources
- JWT-based authentication with role-based access control
- An interactive Swagger/OpenAPI interface for testing and exploration

By introducing this API layer, external systems can interact with WinCC OA in a controlled and secure manner.

Connect → Authenticate → Query → Subscribe
<img width="754" height="424" alt="img" src="https://github.com/user-attachments/assets/53e01562-4556-4fc5-9fe8-deda37918fea" />

<em>Figure 1 – WinCC OA GraphQL & REST API Server Overview</em>

## Version

WinCC OA 3.21 P0 or higher

## Application Name

WinCC OA GraphQL & REST API Server

# Key Features

## GraphQL & REST API Access

- GraphQL queries, mutations, and subscriptions
- REST API endpoints for WinCC OA functionality
- Real-time WebSocket subscriptions using graphql-ws
- Standardized JSON-based communication
- Access to datapoints, CNS, alerts, and system information

## Interactive API Testing

- Apollo Sandbox for GraphQL testing
- Swagger/OpenAPI UI for REST API testing
- Interactive GraphQL schema exploration
- OpenAPI specification access
- Runtime API verification support

## Authentication & Authorization

- JWT bearer authentication
- Administrative and read-only access modes
- Authentication using .env configuration
- Support for direct access tokens
- WebSocket authentication for subscriptions

## WinCC OA Integration

- Integration using the WinCC OA JavaScript Manager
- Datapoint read and write operations
- CNS view and tree creation
- Real-time datapoint subscriptions
- Configuration using .env

## Configuration & Deployment

- Dependency installation using npm
- Windows startup configuration examples
- Startup verification using the WinCC OA Log Viewer
- Common startup troubleshooting guidance
- Security configuration recommendations



 <img width="1900" height="1069" alt="VideoRestGraphQLApi (1) (1)" src="https://github.com/user-attachments/assets/19f51e64-dae6-4178-9ae2-ceb268b2ba51" />

<em>Video 1 – Updating a WinCC OA Datapoint Value via the GraphQL API</em>

# Conclusion

The WinCC OA GraphQL & REST API Server provides a modern and structured interface for accessing WinCC OA functionality using GraphQL and REST technologies.

By combining GraphQL, REST, WebSockets, and JWT-based authentication, the solution enables secure and flexible communication with WinCC OA systems while supporting real-time data access and standardized API workflows.

# Downloads

- WinCC OA Documentation: WinCCOAGraphQLAndRestApiExample.pdf
- Subproject for testing with WinCC OA: WinCCOAGraphQLAndRestApi

# Keywords

WinCC OA, GraphQL, REST API, Node.js, SCADA, API Integration, JWT, OpenAPI, CNS, Datapoints, Industrial Automation.

# Content

This repository includes the project folder, documentation, and legal information of the application example, organized as follows:

- `WinCCOAGraphQLAndRestApi/`: Application example subproject for the WinCC OA GraphQL & REST API Server, including GraphQL and REST API implementation, JavaScript Manager integration, configuration files, authentication handling, and runtime resources

- `WinCCOAGraphQLAndRestApiExample.pdf`: Documentation covering implementation, installation, configuration, security recommendations, and usage of the WinCC OA GraphQL & REST API Server

- `package.winccoa.json`: Package definition file containing metadata, versioning, keywords, and subproject configuration for deployment

- `OSS.md`: Open Source Software information

- `LEGAL_INFO.md`: Legal information

- `LICENSE.md`: License information

- `README.md`: This file
