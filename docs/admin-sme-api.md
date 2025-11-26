# Admin SME Management API Documentation

## Overview

This API allows admin users (admin, super-admin, or member roles) to create and manage SME (Small and Medium-sized Enterprise) users through a multi-step onboarding process. The flow consists of 7 steps where admins can input user and business information, upload documents, and finally send an invitation to the SME user via Clerk authentication.

## Base URL

```
Development: http://localhost:8081
Production: {API_URL from environment}
```

All endpoints are prefixed with `/admin/sme`

## Authentication

All endpoints require authentication via Clerk Bearer token in the Authorization header:

```
Authorization: Bearer <clerk_session_token>
```

**Required Roles:** `admin`, `super-admin`, or `member`

## Onboarding Status

Users progress through the following statuses:

- **`draft`** - User created but onboarding not started or incomplete
- **`pending_invitation`** - Onboarding complete, invitation sent but user hasn't accepted yet
- **`active`** - User has accepted invitation and is active

## Endpoints

### 1. List SME Users

Get a paginated list of all SME users with optional filtering.

**Endpoint:** `GET /admin/sme/users`

**Query Parameters:**
- `page` (string, optional) - Page number (default: 1)
- `limit` (string, optional) - Items per page (default: 50)
- `onboardingStatus` (string, optional) - Filter by status: `draft`, `pending_invitation`, or `active`
- `search` (string, optional) - Search by email, firstName, or lastName

**Request Example:**
```bash
GET /admin/sme/users?page=1&limit=20&onboardingStatus=draft&search=john
```

**Response (200 OK):**
```json
{
  "items": [
    {
      "userId": "clx123abc",
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "onboardingStatus": "draft",
      "onboardingStep": 1,
      "currentStep": 1,
      "completedSteps": [1],
      "business": {
        "id": "biz123",
        "name": "Example Business"
      },
      "createdAt": "2024-01-15T10:30:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

### 2. Get SME User Detail

Get detailed information about a specific SME user.

**Endpoint:** `GET /admin/sme/users/:userId`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Example:**
```bash
GET /admin/sme/users/clx123abc
```

**Response (200 OK):**
```json
{
  "userId": "clx123abc",
  "currentStep": 3,
  "completedSteps": [1, 2, 3],
  "user": {
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "dob": "1990-01-15T00:00:00Z",
    "gender": "male",
    "position": "CEO",
    "onboardingStatus": "draft"
  },
  "business": {
    "id": "biz123",
    "name": "Example Business",
    "entityType": "LLC",
    "logo": "https://example.com/logo.png",
    "sectors": ["Technology", "Finance"],
    "description": "A great business",
    "yearOfIncorporation": 2020,
    "city": "Nairobi",
    "country": "Kenya",
    "companyHQ": "Nairobi, Kenya",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### 3. Create SME User (Step 1)

Create a new SME user and start the onboarding process. This is the first step.

**Endpoint:** `POST /admin/sme/onboarding/start`

**Request Body:**
```json
{
  "email": "john.doe@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "dob": "1990-01-15",
  "gender": "male",
  "position": "CEO"
}
```

**Required Fields:**
- `email` (string) - Valid email address
- `firstName` (string, 1-100 chars)
- `lastName` (string, 1-100 chars)
- `phone` (string, 1-32 chars)
- `dob` (string, ISO date format: YYYY-MM-DD)
- `gender` (string, 1-20 chars)
- `position` (string, 1-50 chars)

**Response (200 OK):**
```json
{
  "userId": "clx123abc",
  "onboardingState": {
    "userId": "clx123abc",
    "currentStep": 1,
    "completedSteps": [1],
    "user": {
      "email": "john.doe@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "phone": "+1234567890",
      "dob": "1990-01-15T00:00:00Z",
      "gender": "male",
      "position": "CEO",
      "onboardingStatus": "draft"
    },
    "business": null
  }
}
```

---

### 4. Update User Info (Step 1)

Update user information for an existing SME user.

**Endpoint:** `PUT /admin/sme/onboarding/:userId/step/1`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Body:** Same as Step 1 creation

**Response (200 OK):** Same as Step 1 creation response

---

### 5. Save Business Basic Info (Step 2)

Save business basic information for the SME user.

**Endpoint:** `PUT /admin/sme/onboarding/:userId/step/2`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Body:**
```json
{
  "logo": "https://example.com/logo.png",
  "name": "Example Business Ltd",
  "entityType": "LLC",
  "year": 2020,
  "sectors": ["Technology", "Finance"],
  "description": "A technology company focused on financial services",
  "userGroupId": "group123",
  "criteria": ["Women-owned", "Tech-enabled"],
  "noOfEmployees": 50,
  "website": "https://example.com",
  "videoLinks": [
    {
      "url": "https://youtube.com/watch?v=abc123",
      "source": "youtube"
    }
  ],
  "businessPhotos": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg"
  ]
}
```

**Required Fields:**
- `name` (string, 1-150 chars)
- `entityType` (string, 1-50 chars)
- `year` (integer, 1900-2100)
- `sectors` (array of strings, min 1 item)

**Optional Fields:**
- `logo` (string) - Logo URL
- `description` (string, max 2000 chars)
- `userGroupId` (string) - User group/program ID
- `criteria` (array of strings) - Selection criteria
- `noOfEmployees` (integer, >= 0)
- `website` (string)
- `videoLinks` (array) - Max items, each with `url` (required) and `source` (optional)
- `businessPhotos` (array of strings) - Max 5 photo URLs

**Response (200 OK):**
```json
{
  "userId": "clx123abc",
  "currentStep": 2,
  "completedSteps": [1, 2],
  "user": {
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "dob": "1990-01-15T00:00:00Z",
    "gender": "male",
    "position": "CEO",
    "onboardingStatus": "draft"
  },
  "business": {
    "id": "biz123",
    "name": "Example Business Ltd"
  }
}
```

---

### 6. Save Location Info (Step 3)

Save business location information.

**Endpoint:** `PUT /admin/sme/onboarding/:userId/step/3`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Body:**
```json
{
  "countriesOfOperation": ["Kenya", "Tanzania", "Uganda"],
  "companyHQ": "Nairobi, Kenya",
  "city": "Nairobi",
  "registeredOfficeAddress": "123 Main Street",
  "registeredOfficeCity": "Nairobi",
  "registeredOfficeZipCode": "00100"
}
```

**Required Fields:**
- `countriesOfOperation` (array of strings, min 1 item)

**Optional Fields:**
- `companyHQ` (string, max 100 chars)
- `city` (string, max 100 chars)
- `registeredOfficeAddress` (string)
- `registeredOfficeCity` (string, max 100 chars)
- `registeredOfficeZipCode` (string, max 20 chars)

**Response (200 OK):** Same format as Step 2 response

---

### 7. Save Personal Documents (Step 4)

Upload personal documents for the SME user.

**Endpoint:** `PUT /admin/sme/onboarding/:userId/step/4`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Body:**
```json
{
  "documents": [
    {
      "docType": "national_id",
      "docUrl": "https://example.com/docs/national_id.pdf"
    },
    {
      "docType": "passport",
      "docUrl": "https://example.com/docs/passport.pdf"
    }
  ]
}
```

**Required Fields:**
- `documents` (array) - Array of document objects
  - `docType` (string, required) - Document type identifier
  - `docUrl` (string, required) - URL to the document

**Response (200 OK):** Same format as Step 2 response

**Note:** If a document with the same `docType` already exists, it will be replaced (upsert behavior).

---

### 8. Save Company Info Documents (Step 5)

Upload company information documents (CR1, CR2, CR8, CR12, etc.).

**Endpoint:** `PUT /admin/sme/onboarding/:userId/step/5`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Body:**
```json
{
  "documents": [
    {
      "docType": "CR1",
      "docUrl": "https://example.com/docs/cr1.pdf",
      "isPasswordProtected": false
    },
    {
      "docType": "CR2",
      "docUrl": "https://example.com/docs/cr2.pdf",
      "isPasswordProtected": true,
      "docPassword": "secure123"
    },
    {
      "docType": "certificate_of_incorporation",
      "docUrl": "https://example.com/docs/incorporation.pdf"
    }
  ]
}
```

**Required Fields:**
- `documents` (array) - Array of document objects
  - `docType` (string, required) - Document type (e.g., "CR1", "CR2", "CR8", "CR12", "certificate_of_incorporation")
  - `docUrl` (string, required) - URL to the document

**Optional Fields:**
- `isPasswordProtected` (boolean) - Whether the document is password protected
- `docPassword` (string) - Password for the document (required if `isPasswordProtected` is true)

**Response (200 OK):** Same format as Step 2 response

---

### 9. Save Financial Documents (Step 6)

Upload financial documents (bank statements, financial statements, etc.).

**Endpoint:** `PUT /admin/sme/onboarding/:userId/step/6`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Body:**
```json
{
  "documents": [
    {
      "docType": "annual_bank_statement",
      "docUrl": "https://example.com/docs/bank_statement_2023.pdf",
      "docYear": 2023,
      "docBankName": "ABC Bank",
      "isPasswordProtected": false
    },
    {
      "docType": "audited_financial_statements",
      "docUrl": "https://example.com/docs/financial_statements_2023.pdf",
      "docYear": 2023,
      "isPasswordProtected": true,
      "docPassword": "secure123"
    }
  ]
}
```

**Required Fields:**
- `documents` (array) - Array of document objects
  - `docType` (string, required) - Document type (e.g., "annual_bank_statement", "audited_financial_statements")
  - `docUrl` (string, required) - URL to the document

**Optional Fields:**
- `docYear` (integer, 1900-2100) - Year of the document
- `docBankName` (string, max 100 chars) - Bank name
- `isPasswordProtected` (boolean) - Whether the document is password protected
- `docPassword` (string) - Password for the document

**Response (200 OK):** Same format as Step 2 response

---

### 10. Save Permits & Pitch Deck (Step 7)

Upload business permits and pitch deck documents.

**Endpoint:** `PUT /admin/sme/onboarding/:userId/step/7`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Body:**
```json
{
  "documents": [
    {
      "docType": "business_permit",
      "docUrl": "https://example.com/docs/business_permit.pdf",
      "isPasswordProtected": false
    },
    {
      "docType": "pitch_deck",
      "docUrl": "https://example.com/docs/pitch_deck.pdf",
      "isPasswordProtected": false
    },
    {
      "docType": "business_plan",
      "docUrl": "https://example.com/docs/business_plan.pdf",
      "isPasswordProtected": true,
      "docPassword": "secure123"
    }
  ]
}
```

**Required Fields:**
- `documents` (array) - Array of document objects
  - `docType` (string, required) - Document type (e.g., "business_permit", "pitch_deck", "business_plan")
  - `docUrl` (string, required) - URL to the document

**Optional Fields:**
- `isPasswordProtected` (boolean) - Whether the document is password protected
- `docPassword` (string) - Password for the document

**Response (200 OK):** Same format as Step 2 response

---

### 11. Get Onboarding State

Get the current onboarding state for a user (progress, completed steps, etc.).

**Endpoint:** `GET /admin/sme/onboarding/:userId`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Response (200 OK):**
```json
{
  "userId": "clx123abc",
  "currentStep": 5,
  "completedSteps": [1, 2, 3, 4, 5],
  "user": {
    "email": "john.doe@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "phone": "+1234567890",
    "dob": "1990-01-15T00:00:00Z",
    "gender": "male",
    "position": "CEO",
    "onboardingStatus": "draft"
  },
  "business": {
    "id": "biz123",
    "name": "Example Business Ltd"
  }
}
```

---

### 12. Send Invitation

Send or resend an invitation to the SME user via Clerk. This should be called after all 7 steps are completed.

**Endpoint:** `POST /admin/sme/onboarding/:userId/invite`

**Path Parameters:**
- `userId` (string, required) - The user ID

**Request Body:** None

**Response (200 OK):**
```json
{
  "success": true,
  "invitationId": "inv_abc123xyz",
  "message": "Invitation sent successfully"
}
```

**Note:** 
- This will send an email invitation to the user via Clerk
- The user's `onboardingStatus` will be updated to `pending_invitation`
- Once the user accepts the invitation and completes Clerk setup, their status will automatically update to `active` via webhook

---

## Error Responses

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "[EMAIL_EXISTS] User with this email already exists",
  "code": "EMAIL_EXISTS"
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "code": "UNAUTHORIZED"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "code": "FORBIDDEN"
}
```

### 404 Not Found
```json
{
  "error": "[USER_NOT_FOUND] User not found",
  "code": "USER_NOT_FOUND"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal error",
  "code": "INTERNAL_ERROR"
}
```

---

## Typical Workflow

### Creating a New SME User

1. **Create User (Step 1)**
   ```bash
   POST /admin/sme/onboarding/start
   ```
   - Save the `userId` from the response

2. **Save Business Info (Step 2)**
   ```bash
   PUT /admin/sme/onboarding/:userId/step/2
   ```

3. **Save Location Info (Step 3)**
   ```bash
   PUT /admin/sme/onboarding/:userId/step/3
   ```

4. **Upload Personal Documents (Step 4)**
   ```bash
   PUT /admin/sme/onboarding/:userId/step/4
   ```

5. **Upload Company Info Documents (Step 5)**
   ```bash
   PUT /admin/sme/onboarding/:userId/step/5
   ```

6. **Upload Financial Documents (Step 6)**
   ```bash
   PUT /admin/sme/onboarding/:userId/step/6
   ```

7. **Upload Permits & Pitch Deck (Step 7)**
   ```bash
   PUT /admin/sme/onboarding/:userId/step/7
   ```

8. **Send Invitation**
   ```bash
   POST /admin/sme/onboarding/:userId/invite
   ```

### Editing an Existing User

- Use the same endpoints with the existing `userId`
- You can update any step by calling the corresponding PUT endpoint
- Check the current state using `GET /admin/sme/onboarding/:userId` or `GET /admin/sme/users/:userId`

### Listing and Filtering Users

- Use `GET /admin/sme/users` to list all users
- Filter by status: `?onboardingStatus=draft`
- Search by name/email: `?search=john`
- Paginate: `?page=1&limit=20`

---

## Notes

1. **Draft State**: Users are created in `draft` status and don't have a Clerk account yet
2. **Invitation Flow**: After sending an invitation, the user receives an email from Clerk. When they accept and complete setup, their status automatically changes to `active` via webhook
3. **Step Updates**: You can update any step at any time by calling the corresponding PUT endpoint
4. **Document Upsert**: Documents are upserted (insert or update) based on `docType`. If a document with the same type exists, it will be replaced
5. **Business Photos**: Maximum 5 photos per business
6. **Date Format**: Use ISO 8601 date format (YYYY-MM-DD) for dates
7. **Pagination**: Default limit is 50 items per page. Maximum recommended limit is 100

