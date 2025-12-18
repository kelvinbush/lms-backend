# Loan Application Timeline API

## Overview

The Loan Application Timeline API provides a complete audit trail of events for loan applications. This endpoint is accessible to both administrators and entrepreneurs (for their own applications).

## Endpoint

**GET** `/loan-applications/:id/timeline`

### Authentication

Requires Clerk authentication. Include the Clerk session token in the Authorization header:

```
Authorization: Bearer <clerk_session_token>
```

### Authorization

- **Admins/Members**: Can view timeline for any loan application
- **Entrepreneurs**: Can view timeline only for their own loan applications (where they are the entrepreneur)

### Path Parameters

```typescript
{
  id: string; // Loan application ID
}
```

### Response (200 OK)

```typescript
{
  data: TimelineEvent[];
}

interface TimelineEvent {
  id: string;                    // Unique event identifier
  type: 
    | "submitted" 
    | "cancelled" 
    | "review_in_progress" 
    | "rejected" 
    | "approved" 
    | "awaiting_disbursement" 
    | "disbursed";
  title: string;                 // Event title (e.g., "Loan submitted successfully")
  description?: string;           // Event description
  date: string;                   // ISO date string (e.g., "2025-01-25")
  time?: string;                 // Time string in 12-hour format (e.g., "6:04PM")
  updatedDate?: string;           // Optional: For in-progress events, when it was last updated
  updatedTime?: string;           // Optional: Time of last update
  performedBy?: string;          // Optional: Name of person who performed the action (e.g., "Shalyne Waweru")
  performedById?: string;        // Optional: ID of the user who performed the action
  lineColor?: "green" | "orange" | "grey";  // Optional: Visual indicator color
}
```

### Error Responses

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Missing or invalid authentication token
- `403 Forbidden`: User does not have permission to view this application
- `404 Not Found`: Loan application not found
- `500 Internal Server Error`: Server error

## Usage Examples

### JavaScript/TypeScript (Fetch API)

```typescript
// Get timeline for a loan application
async function getLoanApplicationTimeline(applicationId: string, clerkToken: string) {
  const response = await fetch(
    `https://api.example.com/loan-applications/${applicationId}/timeline`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${clerkToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch timeline');
  }

  const data = await response.json();
  return data.data; // Array of TimelineEvent[]
}

// Usage
const events = await getLoanApplicationTimeline('app_123', clerkToken);
events.forEach(event => {
  console.log(`${event.date} ${event.time}: ${event.title}`);
  if (event.performedBy) {
    console.log(`  Performed by: ${event.performedBy}`);
  }
});
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';

interface TimelineEvent {
  id: string;
  type: string;
  title: string;
  description?: string;
  date: string;
  time?: string;
  performedBy?: string;
  performedById?: string;
  lineColor?: "green" | "orange" | "grey";
}

export function useLoanApplicationTimeline(applicationId: string) {
  const { getToken } = useAuth();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchTimeline() {
      try {
        setLoading(true);
        const token = await getToken();
        const response = await fetch(
          `/api/loan-applications/${applicationId}/timeline`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch timeline');
        }

        const data = await response.json();
        setEvents(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (applicationId) {
      fetchTimeline();
    }
  }, [applicationId, getToken]);

  return { events, loading, error };
}

// Component usage
function LoanTimeline({ applicationId }: { applicationId: string }) {
  const { events, loading, error } = useLoanApplicationTimeline(applicationId);

  if (loading) return <div>Loading timeline...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="timeline">
      {events.map((event) => (
        <div key={event.id} className={`timeline-event ${event.lineColor}`}>
          <div className="timeline-date">
            {event.date} {event.time && `at ${event.time}`}
          </div>
          <div className="timeline-title">{event.title}</div>
          {event.description && (
            <div className="timeline-description">{event.description}</div>
          )}
          {event.performedBy && (
            <div className="timeline-performer">By: {event.performedBy}</div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Axios Example

```typescript
import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'https://api.example.com',
});

// Add auth token interceptor
apiClient.interceptors.request.use((config) => {
  const token = getClerkToken(); // Your token retrieval logic
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Get timeline
async function getTimeline(applicationId: string) {
  try {
    const response = await apiClient.get(
      `/loan-applications/${applicationId}/timeline`
    );
    return response.data.data;
  } catch (error: any) {
    if (error.response?.status === 403) {
      throw new Error('You do not have permission to view this timeline');
    }
    if (error.response?.status === 404) {
      throw new Error('Loan application not found');
    }
    throw error;
  }
}
```

## Event Types and Colors

| Event Type | Line Color | Description |
|------------|------------|-------------|
| `submitted` | Green | Loan application was submitted |
| `approved` | Green | Loan application was approved |
| `disbursed` | Green | Loan was disbursed |
| `review_in_progress` | Orange | Application is being reviewed |
| `awaiting_disbursement` | Orange | Waiting for disbursement |
| `rejected` | Orange | Application was rejected |
| `cancelled` | Orange | Application was cancelled |

## Notes

- Events are returned in chronological order (oldest first)
- All timestamps are in the server's local timezone
- The `performedBy` field is only populated when a user performed the action
- System-generated events may not have a `performedBy` value
- The timeline includes both audit trail entries and inferred events from the application creation
