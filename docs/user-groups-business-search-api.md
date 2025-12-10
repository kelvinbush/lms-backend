# User Groups - Business Management API

## Overview
Complete API for managing businesses in user groups: search, assign, and remove businesses. All endpoints require authentication with `admin`, `super-admin`, or `member` role.

## Endpoints

1. **GET** `/user-groups/:groupId/businesses/search` - Search businesses
2. **POST** `/user-groups/:groupId/businesses` - Assign businesses to group
3. **DELETE** `/user-groups/:groupId/businesses/:businessId` - Remove business from group

---

## 1. Search Businesses

**GET** `/user-groups/:groupId/businesses/search`

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `search` | string | No | Search term for business name or owner email | `?search=acme` |
| `page` | string | No | Page number (default: 1) | `?page=1` |
| `limit` | string | No | Items per page (default: 20, max: 100) | `?limit=20` |

### Response

**200 OK**
```typescript
{
  success: boolean;
  message: string;
  data: BusinessSearchItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

interface BusinessSearchItem {
  id: string;
  name: string;
  description?: string | null;
  sector?: string | null;
  country?: string | null;
  city?: string | null;
  owner: {
    id: string;
    firstName?: string | null;
    lastName?: string | null;
    email: string;
  };
  isAlreadyInGroup: boolean; // ⭐ Key field - indicates if business is already assigned
}
```

### Usage Examples

#### Basic Search
```typescript
// Search for businesses
const response = await fetch(
  '/user-groups/group_123/businesses/search?search=tech&page=1&limit=20',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);

const { data, pagination } = await response.json();

// Display businesses
data.forEach(business => {
  if (business.isAlreadyInGroup) {
    // Show "Already Assigned" badge or disable button
  } else {
    // Show "Assign to Group" button
  }
});
```

#### With Pagination
```typescript
const searchBusinesses = async (groupId: string, searchTerm: string, page: number = 1) => {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: '20'
  });
  
  if (searchTerm) {
    params.append('search', searchTerm);
  }
  
  const response = await fetch(
    `/user-groups/${groupId}/businesses/search?${params}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  
  return await response.json();
};
```

---

## 2. Assign Businesses to Group

**POST** `/user-groups/:groupId/businesses`

Assigns one or more businesses to a user group. Handles duplicates gracefully (skips already assigned businesses).

### Request Body

```typescript
{
  businessIds: string[]; // Array of business IDs (min 1, unique)
}
```

### Response

**200 OK**
```typescript
{
  success: boolean;
  message: string;
  assigned: number;      // Number of businesses successfully assigned
  skipped: number;       // Number already in group
  invalid: string[];     // Array of invalid business IDs
}
```

### Usage Example

```typescript
// Assign multiple businesses
const assignBusinesses = async (groupId: string, businessIds: string[]) => {
  const response = await fetch(
    `/user-groups/${groupId}/businesses`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ businessIds })
    }
  );
  
  const result = await response.json();
  
  // Handle result
  if (result.assigned > 0) {
    console.log(`✅ Assigned ${result.assigned} business(es)`);
  }
  if (result.skipped > 0) {
    console.log(`⚠️ ${result.skipped} already assigned`);
  }
  if (result.invalid.length > 0) {
    console.log(`❌ Invalid IDs: ${result.invalid.join(', ')}`);
  }
  
  return result;
};

// Single business assignment
await assignBusinesses('group_123', ['business_456']);

// Multiple businesses
await assignBusinesses('group_123', ['business_456', 'business_789', 'business_101']);
```

### Error Handling

| Status | Description |
|--------|-------------|
| 400 | Invalid input (empty businessIds array) |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | User group not found |
| 500 | Server error |

---

## 3. Remove Business from Group

**DELETE** `/user-groups/:groupId/businesses/:businessId`

Removes a single business from a user group.

### Path Parameters

- `groupId` (string, required) - The user group ID
- `businessId` (string, required) - The business ID to remove

### Response

**200 OK**
```typescript
{
  success: boolean;
  message: string;
}
```

### Usage Example

```typescript
const removeBusiness = async (groupId: string, businessId: string) => {
  const response = await fetch(
    `/user-groups/${groupId}/businesses/${businessId}`,
    {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  );
  
  if (!response.ok) {
    throw new Error('Failed to remove business');
  }
  
  return await response.json();
};

// Remove a business
await removeBusiness('group_123', 'business_456');
```

### Error Handling

| Status | Description |
|--------|-------------|
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | User group not found OR business not in group |
| 500 | Server error |

---

## Complete Workflow Example

```typescript
// 1. Search for businesses
const searchResults = await fetch(
  `/user-groups/${groupId}/businesses/search?search=tech`,
  { headers: { 'Authorization': `Bearer ${token}` } }
);
const { data: businesses } = await searchResults.json();

// 2. Filter unassigned businesses
const unassigned = businesses.filter(b => !b.isAlreadyInGroup);

// 3. Assign selected businesses
if (unassigned.length > 0) {
  const businessIds = unassigned.map(b => b.id);
  const assignResult = await fetch(
    `/user-groups/${groupId}/businesses`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ businessIds })
    }
  );
  const result = await assignResult.json();
  console.log(`Assigned ${result.assigned} businesses`);
}

// 4. Remove a business if needed
await fetch(
  `/user-groups/${groupId}/businesses/${businessId}`,
  {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  }
);
```

---

## UI Recommendations

### Display Pattern
```tsx
// React example
{businesses.map(business => (
  <BusinessCard key={business.id}>
    <BusinessName>{business.name}</BusinessName>
    <BusinessInfo>
      {business.sector && <Badge>{business.sector}</Badge>}
      {business.city && <Location>{business.city}, {business.country}</Location>}
    </BusinessInfo>
    <OwnerInfo>
      <Email>{business.owner.email}</Email>
      {business.owner.firstName && (
        <Name>{business.owner.firstName} {business.owner.lastName}</Name>
      )}
    </OwnerInfo>
    
    {business.isAlreadyInGroup ? (
      <Badge variant="success">Already Assigned</Badge>
    ) : (
      <Button onClick={() => assignBusiness(business.id)}>
        Assign to Group
      </Button>
    )}
  </BusinessCard>
))}
```

### Complete UI Example

```tsx
// React example with full CRUD
const BusinessGroupManager = ({ groupId }) => {
  const [businesses, setBusinesses] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  // Search businesses
  const searchBusinesses = async () => {
    const response = await fetch(
      `/user-groups/${groupId}/businesses/search?search=${searchTerm}`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    );
    const { data } = await response.json();
    setBusinesses(data);
  };

  // Assign selected businesses
  const assignSelected = async () => {
    const businessIds = Array.from(selected);
    const response = await fetch(
      `/user-groups/${groupId}/businesses`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ businessIds })
      }
    );
    const result = await response.json();
    
    if (result.assigned > 0) {
      // Refresh search results
      searchBusinesses();
      setSelected(new Set());
    }
  };

  // Remove business
  const removeBusiness = async (businessId: string) => {
    await fetch(
      `/user-groups/${groupId}/businesses/${businessId}`,
      {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );
    searchBusinesses(); // Refresh
  };

  return (
    <div>
      <SearchInput 
        value={searchTerm}
        onChange={setSearchTerm}
        onSearch={searchBusinesses}
      />
      
      <BusinessList>
        {businesses.map(business => (
          <BusinessCard key={business.id}>
            <Checkbox
              checked={selected.has(business.id)}
              disabled={business.isAlreadyInGroup}
              onChange={(checked) => {
                if (checked) {
                  setSelected(new Set([...selected, business.id]));
                } else {
                  const newSet = new Set(selected);
                  newSet.delete(business.id);
                  setSelected(newSet);
                }
              }}
            />
            
            <BusinessInfo>
              <Name>{business.name}</Name>
              <Owner>{business.owner.email}</Owner>
            </BusinessInfo>
            
            {business.isAlreadyInGroup ? (
              <>
                <Badge>Assigned</Badge>
                <Button onClick={() => removeBusiness(business.id)}>
                  Remove
                </Button>
              </>
            ) : (
              <Button onClick={() => assignSelected()}>
                Assign
              </Button>
            )}
          </BusinessCard>
        ))}
      </BusinessList>
    </div>
  );
};
```

### Search Input
- **Debounce**: Wait 300-500ms after user stops typing before making request
- **Minimum length**: Only search if term is 2+ characters (optional)
- **Loading state**: Show loading indicator during search

### Pagination
- Display pagination controls using `pagination.totalPages`
- Show "Page X of Y" using `pagination.page` and `pagination.totalPages`
- Display total count: "Found {pagination.total} businesses"

## General Error Handling

All endpoints may return:

| Status | Description |
|--------|-------------|
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions (not admin/super-admin/member) |
| 404 | Resource not found (group, business, or assignment) |
| 500 | Server error |

## Important Notes

### Search Endpoint
- **Search fields**: Searches both business name and owner email simultaneously
- **Active businesses only**: Only returns businesses that haven't been soft-deleted
- **Case-insensitive**: Search is case-insensitive
- **Partial matching**: Uses LIKE pattern matching (e.g., "tech" matches "Technology Corp")
- **Performance**: Optimized with indexed fields for fast searches

### Assign Endpoint
- **Batch operations**: Can assign multiple businesses in a single request
- **Duplicate handling**: Automatically skips businesses already in the group
- **Validation**: Validates that businesses exist and are active before assigning
- **Idempotent**: Safe to call multiple times (duplicates are skipped)
- **Response details**: Returns counts for assigned, skipped, and invalid IDs

### Remove Endpoint
- **Single operation**: Removes one business at a time
- **Validation**: Verifies business is actually in the group before removal
- **Safe**: Returns 404 if business is not in group (no error thrown)
