# API Overview & Frontend Integration Guide

## Introduction

This document provides a high-level overview of the Melanin Kapital backend API structure and guidance for frontend integration. The API follows RESTful conventions with consistent patterns across all endpoints.

## Base URL

```
https://api.melaninkapital.com
```

For development:
```
http://localhost:8081
```

## Authentication

All API endpoints (except public ones) require authentication via Clerk JWT tokens.

### Headers
```
Authorization: Bearer <clerk_jwt_token>
Content-Type: application/json
```

### Getting Tokens
Tokens are obtained through Clerk authentication in your frontend application. Include the JWT in the Authorization header for all authenticated requests.

## Response Format

### Success Responses
Most endpoints return data directly with appropriate HTTP status codes:

```typescript
// Single resource
{
  id: string;
  name: string;
  // ... other fields
}

// Array of resources
[
  { id: string, name: string },
  { id: string, name: string }
]

// Paginated response
{
  data: Resource[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

### Error Responses
All errors follow consistent format:

```typescript
{
  error: string; // Human-readable message
  code: string; // Machine-readable error code
  details?: any; // Additional error context (optional)
}
```

### HTTP Status Codes
- `2xx`: Success
- `4xx`: Client errors (validation, auth, permissions)
- `5xx`: Server errors

## Core API Modules

### 1. Authentication & Users
- **Base**: `/api/auth/*`, `/api/users/*`
- **Purpose**: User management, authentication, profile management
- **Key Features**: Clerk integration, role-based access

### 2. Business Management
- **Base**: `/api/businesses/*`
- **Purpose**: Company profiles, business documents, business verification
- **Key Features**: Business CRUD, document upload, business details

### 3. Loan Applications
- **Base**: `/api/loan-applications/*`
- **Purpose**: Complete loan lifecycle management
- **Key Features**: Application CRUD, status tracking, document verification
- **Documentation**: [LOAN_APPLICATIONS_API.md](./LOAN_APPLICATIONS_API.md)

### 4. KYC/KYB Verification
- **Base**: `/api/loan-applications/:id/kyc-kyb/*`
- **Purpose**: Document verification workflow
- **Key Features**: Document review, bulk verification, status transitions
- **Documentation**: [KYC_KYB_API.md](./KYC_KYB_API.md)

### 5. Loan Products
- **Base**: `/api/loan-products/*`
- **Purpose**: Loan product management and eligibility
- **Key Features**: Product catalog, fee calculation, eligibility rules

### 6. Documents
- **Base**: `/api/documents/*`, `/api/business-documents/*`
- **Purpose**: Document management for users and businesses
- **Key Features**: Upload, verification, document types

### 7. Notifications & Emails
- **Base**: `/api/notifications/*`
- **Purpose**: User notifications and email management
- **Key Features**: Email preferences, notification history

## Role-Based Access Control

The API implements role-based permissions:

### User Roles
```typescript
type UserRole = "super-admin" | "admin" | "member" | "entrepreneur";
```

### Permission Hierarchy
```
super-admin > admin > member > entrepreneur
```

### Access Patterns
- **Entrepreneurs**: Can manage own data, create applications, view own resources
- **Members**: Basic admin access, limited system operations
- **Admins**: Full business and application management
- **Super Admins**: System configuration, user management, all operations

## Common Integration Patterns

### 1. Error Handling
Implement consistent error handling across your frontend:

```typescript
const handleApiError = (error: any) => {
  if (error.response) {
    const { error: message, code } = error.response.data;
    
    switch (code) {
      case 'UNAUTHORIZED':
        // Redirect to login
        break;
      case 'FORBIDDEN':
        // Show permission denied
        break;
      case 'VALIDATION_ERROR':
        // Show field validation errors
        break;
      default:
        // Show generic error message
        break;
    }
  } else {
    // Network or other errors
  }
};
```

### 2. Pagination
For list endpoints, implement pagination controls:

```typescript
const fetchPage = async (page: number) => {
  const response = await api.get('/loan-applications', {
    params: { page: page.toString(), limit: '20' }
  });
  
  return {
    data: response.data,
    hasMore: response.pagination.hasNext,
    nextPage: page + 1
  };
};
```

### 3. Real-time Updates
For real-time features (status changes, notifications):

- **Webhooks**: Configure webhooks for critical events
- **Polling**: Use for non-critical updates with appropriate intervals
- **Server-Sent Events**: Where available for live updates

### 4. File Uploads
Document and image uploads follow multipart form data:

```typescript
const uploadDocument = async (file: File, type: string) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('docType', type);
  
  return api.post('/documents', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
};
```

### 5. Search Implementation
Search endpoints support partial matching across multiple fields:

```typescript
const searchApplications = (query: string) => {
  return api.get('/loan-applications', {
    params: { search: query, limit: '50' }
  });
};
```

## Data Types & Interfaces

### Common Patterns
- **IDs**: String-based UUIDs
- **Dates**: ISO 8601 strings
- **Currency**: ISO currency codes with decimal amounts
- **Status**: String enums with specific values
- **Pagination**: Consistent pagination objects

### Example Interfaces
```typescript
// Base user
interface User {
  id: string;
  clerkId: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

// Base business
interface Business {
  id: string;
  name: string;
  // ... other fields
}

// API response wrapper
interface ApiResponse<T> {
  data?: T;
  error?: string;
  code?: string;
}
```

## Rate Limiting

- **Standard Limits**: Apply to all endpoints
- **Burst Limits**: Short-term higher limits
- **Rate Limit Headers**: Included in responses
- **Retry-After**: Header indicates when to retry

## Caching Strategy

- **ETags**: Supported for GET requests
- **Cache-Control**: Headers indicate caching policies
- **Conditional Requests**: Use If-None-Match for efficient updates

## Environment Configuration

### Development
```
API_URL: http://localhost:8081
CORS_ORIGINS: http://localhost:3000
```

### Production
```
API_URL: https://api.melaninkapital.com
CORS_ORIGINS: https://app.melaninkapital.com
```

## Testing & Development

### Postman Collections
Import the provided Postman collections for API testing.

### Environment Variables
Configure these in your development environment:
- `REACT_APP_API_URL`: Backend API URL
- `REACT_APP_CLERK_PUBLISHABLE_KEY`: Clerk public key

### Mock Data
Use the provided mock data generators for frontend development:
- User mock data
- Business mock data
- Loan application mock data

## Security Considerations

### 1. Token Management
- Store JWT tokens securely
- Implement token refresh
- Handle token expiration gracefully

### 2. Input Validation
- Validate all user inputs
- Sanitize data before sending
- Use proper error handling

### 3. HTTPS
- Always use HTTPS in production
- Verify SSL certificates
- Implement HSTS headers

### 4. CORS
- Configure proper CORS origins
- Handle preflight requests
- Use appropriate headers

## Monitoring & Analytics

### Error Tracking
Implement error tracking for:
- API failures
- Network issues
- User-reported errors

### Performance Monitoring
Monitor:
- Response times
- Error rates
- User experience metrics

## Support & Resources

### API Documentation
- **Complete API**: This overview document
- **Loan Applications**: [LOAN_APPLICATIONS_API.md](./LOAN_APPLICATIONS_API.md)
- **KYC/KYB**: [KYC_KYB_API.md](./KYC_KYB_API.md)

### Support Channels
- **Technical Support**: api-support@melaninkapital.com
- **Documentation Issues**: docs@melaninkapital.com
- **Status Page**: https://status.melaninkapital.com

### Changelog
API changes are documented in:
- **Breaking Changes**: Announced 30 days in advance
- **New Features**: Added to relevant documentation
- **Deprecations**: Clearly marked with removal timeline
