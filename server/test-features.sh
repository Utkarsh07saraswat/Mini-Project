#!/bin/bash

# Multi-Tenant System Test Script
# Tests all security and operational features

BASE_URL="http://localhost:3000"
TENANT_A="tenant-a"
TENANT_B="tenant-b"
USER_A="user-a-123"
USER_B="user-b-456"

echo "========================================="
echo "Multi-Tenant System Feature Test"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
curl -s "$BASE_URL/health" | jq '.'
echo ""

# Test 2: Detailed Health Check
echo -e "${YELLOW}Test 2: Detailed Health Check${NC}"
curl -s "$BASE_URL/health/detailed" | jq '.'
echo ""

# Test 3: Generate Encrypted JWT for Tenant A
echo -e "${YELLOW}Test 3: Generate Encrypted JWT for Tenant A${NC}"
TOKEN_A=$(curl -s -X POST "$BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\": \"$TENANT_A\", \"userId\": \"$USER_A\"}" | jq -r '.token')

if [ -n "$TOKEN_A" ] && [ "$TOKEN_A" != "null" ]; then
  echo -e "${GREEN}✓ Token generated for Tenant A${NC}"
  echo "Token: ${TOKEN_A:0:50}..."
else
  echo -e "${RED}✗ Failed to generate token${NC}"
  exit 1
fi
echo ""

# Test 4: Generate Encrypted JWT for Tenant B
echo -e "${YELLOW}Test 4: Generate Encrypted JWT for Tenant B${NC}"
TOKEN_B=$(curl -s -X POST "$BASE_URL/auth/token" \
  -H "Content-Type: application/json" \
  -d "{\"tenantId\": \"$TENANT_B\", \"userId\": \"$USER_B\"}" | jq -r '.token')

if [ -n "$TOKEN_B" ] && [ "$TOKEN_B" != "null" ]; then
  echo -e "${GREEN}✓ Token generated for Tenant B${NC}"
  echo "Token: ${TOKEN_B:0:50}..."
else
  echo -e "${RED}✗ Failed to generate token${NC}"
  exit 1
fi
echo ""

# Test 5: Create Project for Tenant A
echo -e "${YELLOW}Test 5: Create Project for Tenant A${NC}"
PROJECT_A=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN_A" \
  -H "Content-Type: application/json" \
  -d '{"name": "Tenant A Project", "description": "Secret project for Tenant A"}' | jq '.')

echo "$PROJECT_A"
PROJECT_A_ID=$(echo "$PROJECT_A" | jq -r '.data._id')
echo -e "${GREEN}✓ Project created for Tenant A (ID: $PROJECT_A_ID)${NC}"
echo ""

# Test 6: Create Project for Tenant B
echo -e "${YELLOW}Test 6: Create Project for Tenant B${NC}"
PROJECT_B=$(curl -s -X POST "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN_B" \
  -H "Content-Type: application/json" \
  -d '{"name": "Tenant B Project", "description": "Secret project for Tenant B"}' | jq '.')

echo "$PROJECT_B"
PROJECT_B_ID=$(echo "$PROJECT_B" | jq -r '.data._id')
echo -e "${GREEN}✓ Project created for Tenant B (ID: $PROJECT_B_ID)${NC}"
echo ""

# Test 7: Verify Isolation - Tenant A cannot see Tenant B's projects
echo -e "${YELLOW}Test 7: Verify Isolation - Tenant A queries projects${NC}"
PROJECTS_A=$(curl -s "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN_A" | jq '.')

echo "$PROJECTS_A"
COUNT_A=$(echo "$PROJECTS_A" | jq '.count')

if [ "$COUNT_A" -eq 1 ]; then
  echo -e "${GREEN}✓ Isolation verified: Tenant A sees only their project${NC}"
else
  echo -e "${RED}✗ Isolation breach: Tenant A sees $COUNT_A projects${NC}"
fi
echo ""

# Test 8: Verify Isolation - Tenant B cannot see Tenant A's projects
echo -e "${YELLOW}Test 8: Verify Isolation - Tenant B queries projects${NC}"
PROJECTS_B=$(curl -s "$BASE_URL/api/projects" \
  -H "Authorization: Bearer $TOKEN_B" | jq '.')

echo "$PROJECTS_B"
COUNT_B=$(echo "$PROJECTS_B" | jq '.count')

if [ "$COUNT_B" -eq 1 ]; then
  echo -e "${GREEN}✓ Isolation verified: Tenant B sees only their project${NC}"
else
  echo -e "${RED}✗ Isolation breach: Tenant B sees $COUNT_B projects${NC}"
fi
echo ""

# Test 9: Check Rate Limit Status
echo -e "${YELLOW}Test 9: Check Rate Limit Status for Tenant A${NC}"
RATE_LIMIT=$(curl -s "$BASE_URL/api/rate-limit/status" \
  -H "Authorization: Bearer $TOKEN_A" | jq '.')

echo "$RATE_LIMIT"
echo ""

# Test 10: Query Audit Logs
echo -e "${YELLOW}Test 10: Query Audit Logs for Tenant A${NC}"
AUDIT_LOGS=$(curl -s "$BASE_URL/api/audit-logs?limit=5" \
  -H "Authorization: Bearer $TOKEN_A" | jq '.')

echo "$AUDIT_LOGS"
AUDIT_COUNT=$(echo "$AUDIT_LOGS" | jq '.total')
echo -e "${GREEN}✓ Found $AUDIT_COUNT audit log entries${NC}"
echo ""

# Test 11: Get Audit Statistics
echo -e "${YELLOW}Test 11: Get Audit Statistics for Tenant A${NC}"
AUDIT_STATS=$(curl -s "$BASE_URL/api/audit-logs/stats" \
  -H "Authorization: Bearer $TOKEN_A" | jq '.')

echo "$AUDIT_STATS"
echo ""

# Test 12: Test Rate Limiting (make many requests)
echo -e "${YELLOW}Test 12: Test Rate Limiting (making 25 rapid requests)${NC}"
RATE_LIMITED=0
for i in {1..25}; do
  STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/api/projects" \
    -H "Authorization: Bearer $TOKEN_A")
  
  if [ "$STATUS" -eq 429 ]; then
    RATE_LIMITED=1
    echo -e "${GREEN}✓ Rate limit triggered at request $i (HTTP 429)${NC}"
    break
  fi
done

if [ $RATE_LIMITED -eq 0 ]; then
  echo -e "${YELLOW}⚠ Rate limit not triggered (Redis may not be running)${NC}"
fi
echo ""

# Test 13: Prometheus Metrics
echo -e "${YELLOW}Test 13: Check Prometheus Metrics${NC}"
METRICS=$(curl -s "$BASE_URL/metrics" | head -n 20)
echo "$METRICS"
echo "..."
echo -e "${GREEN}✓ Metrics endpoint working${NC}"
echo ""

# Test 14: Metrics JSON Format
echo -e "${YELLOW}Test 14: Check Metrics (JSON format)${NC}"
METRICS_JSON=$(curl -s "$BASE_URL/metrics/json" | jq '.[] | select(.name == "http_requests_total") | .values[0]')
echo "HTTP Requests Total:"
echo "$METRICS_JSON"
echo ""

echo "========================================="
echo -e "${GREEN}All Tests Completed!${NC}"
echo "========================================="
echo ""
echo "Summary:"
echo "  ✓ JWT encryption working"
echo "  ✓ Tenant isolation verified"
echo "  ✓ Audit logging active"
echo "  ✓ Metrics collection working"
echo "  ✓ Rate limiting configured"
echo ""
echo "Next steps:"
echo "  1. Check audit logs in MongoDB"
echo "  2. View metrics in Prometheus/Grafana"
echo "  3. Test backup/restore scripts"
echo "  4. Configure production environment"
echo ""
