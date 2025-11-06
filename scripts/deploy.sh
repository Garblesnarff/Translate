#!/bin/bash
set -euo pipefail

# Tibetan Translation Tool - Deployment Script
# This script automates the deployment process

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DEPLOY_ENV="${1:-staging}"
VERSION="${2:-latest}"

echo "========================================="
echo "Tibetan Translation Tool - Deployment"
echo "Environment: $DEPLOY_ENV"
echo "Version: $VERSION"
echo "========================================="

# Validate environment
if [[ ! "$DEPLOY_ENV" =~ ^(development|staging|production)$ ]]; then
    echo -e "${RED}ERROR: Invalid environment. Use: development, staging, or production${NC}"
    exit 1
fi

# Confirmation for production
if [ "$DEPLOY_ENV" == "production" ]; then
    read -p "⚠️  Deploy to PRODUCTION? This will affect live users. Type 'yes' to continue: " confirm
    if [ "$confirm" != "yes" ]; then
        echo "Deployment cancelled"
        exit 0
    fi
fi

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo -e "\n${YELLOW}Checking prerequisites...${NC}"

if ! command_exists docker; then
    echo -e "${RED}ERROR: Docker is not installed${NC}"
    exit 1
fi

if ! command_exists git; then
    echo -e "${RED}ERROR: Git is not installed${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"

# Check for uncommitted changes
echo -e "\n${YELLOW}Checking for uncommitted changes...${NC}"
if ! git diff-index --quiet HEAD --; then
    echo -e "${RED}ERROR: You have uncommitted changes. Commit or stash them first.${NC}"
    git status
    exit 1
fi
echo -e "${GREEN}✓ Git working directory clean${NC}"

# Pull latest code
echo -e "\n${YELLOW}Pulling latest code...${NC}"
git fetch origin
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if [ "$DEPLOY_ENV" == "production" ]; then
    git checkout main
    git pull origin main
elif [ "$DEPLOY_ENV" == "staging" ]; then
    git checkout develop
    git pull origin develop
fi

echo -e "${GREEN}✓ Code updated${NC}"

# Load environment variables
echo -e "\n${YELLOW}Loading environment configuration...${NC}"
if [ ! -f ".env.${DEPLOY_ENV}" ]; then
    echo -e "${RED}ERROR: .env.${DEPLOY_ENV} file not found${NC}"
    exit 1
fi

# Export environment variables
export $(grep -v '^#' ".env.${DEPLOY_ENV}" | xargs)
echo -e "${GREEN}✓ Environment loaded${NC}"

# Run tests
echo -e "\n${YELLOW}Running tests...${NC}"
if ! npm run test; then
    echo -e "${RED}ERROR: Tests failed. Deployment aborted.${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Tests passed${NC}"

# Build application
echo -e "\n${YELLOW}Building application...${NC}"
if ! npm run build; then
    echo -e "${RED}ERROR: Build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Build completed${NC}"

# Build Docker image
echo -e "\n${YELLOW}Building Docker image...${NC}"
DOCKER_TAG="tibetan-translate:${VERSION}-${DEPLOY_ENV}"
if ! docker build -t "$DOCKER_TAG" .; then
    echo -e "${RED}ERROR: Docker build failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Docker image built: $DOCKER_TAG${NC}"

# Test Docker image
echo -e "\n${YELLOW}Testing Docker image...${NC}"
TEST_CONTAINER_NAME="test-tibetan-translate-$$"

# Stop and remove test container if it exists
docker stop "$TEST_CONTAINER_NAME" 2>/dev/null || true
docker rm "$TEST_CONTAINER_NAME" 2>/dev/null || true

# Run test container
docker run -d --name "$TEST_CONTAINER_NAME" \
    -p 15439:5439 \
    -e NODE_ENV=test \
    -e DATABASE_URL=sqlite:///tmp/test.db \
    "$DOCKER_TAG"

# Wait for container to start
echo "Waiting for container to start..."
sleep 10

# Test health endpoint
if curl -f http://localhost:15439/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${RED}ERROR: Health check failed${NC}"
    docker logs "$TEST_CONTAINER_NAME"
    docker stop "$TEST_CONTAINER_NAME"
    docker rm "$TEST_CONTAINER_NAME"
    exit 1
fi

# Cleanup test container
docker stop "$TEST_CONTAINER_NAME"
docker rm "$TEST_CONTAINER_NAME"

# Database migrations
echo -e "\n${YELLOW}Running database migrations...${NC}"
if ! npm run migrate:v2; then
    echo -e "${RED}ERROR: Database migration failed${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Database migrations completed${NC}"

# Deploy based on environment
echo -e "\n${YELLOW}Deploying to $DEPLOY_ENV...${NC}"

case $DEPLOY_ENV in
    development)
        docker-compose -f docker-compose.yml up -d --build
        ;;
    staging)
        docker-compose -f docker-compose.staging.yml up -d --build
        ;;
    production)
        # Stop old container
        docker stop tibetan-translate 2>/dev/null || true
        docker rm tibetan-translate 2>/dev/null || true

        # Start new container
        docker run -d \
            --name tibetan-translate \
            -p 5439:5439 \
            --restart unless-stopped \
            -e DATABASE_URL="$DATABASE_URL" \
            -e REDIS_URL="$REDIS_URL" \
            -e GEMINI_API_KEY_ODD="$GEMINI_API_KEY_ODD" \
            -e GEMINI_API_KEY_EVEN="$GEMINI_API_KEY_EVEN" \
            -e SESSION_SECRET="$SESSION_SECRET" \
            -e NODE_ENV=production \
            -v tibetan-uploads:/app/uploads \
            -v tibetan-cache:/app/cache \
            -v tibetan-logs:/app/logs \
            "$DOCKER_TAG"
        ;;
esac

echo -e "${GREEN}✓ Deployment completed${NC}"

# Verify deployment
echo -e "\n${YELLOW}Verifying deployment...${NC}"
sleep 5

if curl -f http://localhost:5439/api/health >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Application is running and healthy${NC}"
else
    echo -e "${RED}ERROR: Health check failed after deployment${NC}"
    docker logs tibetan-translate
    exit 1
fi

# Tag deployment
if [ "$DEPLOY_ENV" == "production" ]; then
    DEPLOY_TAG="deploy-production-$(date +%Y%m%d-%H%M%S)"
    git tag -a "$DEPLOY_TAG" -m "Production deployment: $VERSION"
    echo -e "${GREEN}✓ Created deployment tag: $DEPLOY_TAG${NC}"
fi

# Display status
echo -e "\n========================================="
echo -e "${GREEN}Deployment successful!${NC}"
echo "========================================="
echo "Environment: $DEPLOY_ENV"
echo "Version: $VERSION"
echo "Container: $DOCKER_TAG"
echo "Health Check: http://localhost:5439/api/health"
echo "Application: http://localhost:5439"
echo ""
echo "View logs: docker logs tibetan-translate -f"
echo "Stop: docker stop tibetan-translate"
echo "Restart: docker restart tibetan-translate"
echo "========================================="

# Send notification (optional)
if [ -n "${SLACK_WEBHOOK_URL:-}" ]; then
    curl -X POST "$SLACK_WEBHOOK_URL" \
        -H 'Content-Type: application/json' \
        -d "{\"text\":\"✅ Deployment to $DEPLOY_ENV completed successfully (v$VERSION)\"}" \
        >/dev/null 2>&1 || true
fi

exit 0
