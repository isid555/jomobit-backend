#!/bin/bash

# JOMO Backend Deployment Script
# Usage: ./scripts/deploy.sh [environment] [image_tag]

set -e

# Configuration
DOCKER_IMAGE="ai29/jomo-backend"
CONTAINER_NAME="jomo-backend"
ENVIRONMENT=${1:-production}
IMAGE_TAG=${2:-latest}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running on target server
check_environment() {
    log_info "Checking deployment environment..."
    
    if [ "$ENVIRONMENT" = "production" ]; then
        log_warning "Deploying to PRODUCTION environment"
        read -p "Are you sure you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            log_error "Deployment cancelled"
            exit 1
        fi
    fi
}

# Load environment variables from file
load_env_vars() {
    log_info "Loading environment variables..."
    
    if [ -f ".env.${ENVIRONMENT}" ]; then
        source ".env.${ENVIRONMENT}"
        log_success "Loaded .env.${ENVIRONMENT}"
    elif [ -f ".env" ]; then
        source ".env"
        log_success "Loaded .env"
    else
        log_warning "No environment file found, using system environment variables"
    fi
}

# Pull Docker image
pull_image() {
    log_info "Pulling Docker image: ${DOCKER_IMAGE}:${IMAGE_TAG}"
    
    if docker pull "${DOCKER_IMAGE}:${IMAGE_TAG}"; then
        log_success "Image pulled successfully"
    else
        log_error "Failed to pull image"
        exit 1
    fi
}

# Zero-downtime deployment
deploy_container() {
    log_info "Starting zero-downtime deployment..."
    
    # Check if container exists
    if docker ps -q -f name="${CONTAINER_NAME}" | grep -q .; then
        log_info "Existing container found, performing rolling update..."
        
        # Start new container on different port
        NEW_CONTAINER_NAME="${CONTAINER_NAME}-new"
        
        log_info "Starting new container: ${NEW_CONTAINER_NAME}"
        docker run -d \
            --name "${NEW_CONTAINER_NAME}" \
            --restart unless-stopped \
            -p 3001:3000 \
            $(get_env_args) \
            "${DOCKER_IMAGE}:${IMAGE_TAG}"
        
        # Health check new container
        log_info "Performing health check on new container..."
        if ! health_check "3001"; then
            log_error "Health check failed on new container"
            docker stop "${NEW_CONTAINER_NAME}" || true
            docker rm "${NEW_CONTAINER_NAME}" || true
            exit 1
        fi
        
        # Stop old container
        log_info "Stopping old container..."
        docker stop "${CONTAINER_NAME}" || true
        docker rm "${CONTAINER_NAME}" || true
        
        # Rename new container and switch port
        docker stop "${NEW_CONTAINER_NAME}"
        docker rm "${NEW_CONTAINER_NAME}"
        
        # Start production container
        log_info "Starting production container..."
        docker run -d \
            --name "${CONTAINER_NAME}" \
            --restart unless-stopped \
            -p 3000:3000 \
            $(get_env_args) \
            "${DOCKER_IMAGE}:${IMAGE_TAG}"
    else
        log_info "No existing container found, starting fresh deployment..."
        docker run -d \
            --name "${CONTAINER_NAME}" \
            --restart unless-stopped \
            -p 3000:3000 \
            $(get_env_args) \
            "${DOCKER_IMAGE}:${IMAGE_TAG}"
    fi
    
    # Final health check
    log_info "Performing final health check..."
    if health_check "3000"; then
        log_success "Deployment completed successfully!"
    else
        log_error "Final health check failed!"
        exit 1
    fi
}

# Generate environment arguments for docker run
get_env_args() {
    cat << EOF
-e NODE_ENV=${NODE_ENV:-production} \
-e PORT=${PORT:-3000} \
-e FRONTEND_URL=${FRONTEND_URL} \
-e MONGODB_URI=${MONGODB_URI} \
-e REDIS_URL=${REDIS_URL} \
-e LOG_LEVEL=${LOG_LEVEL:-info} \
-e AUTH0_DOMAIN=${AUTH0_DOMAIN} \
-e AUTH0_AUDIENCE=${AUTH0_AUDIENCE} \
-e AUTH0_CLIENT_ID=${AUTH0_CLIENT_ID} \
-e AUTH0_CLIENT_SECRET=${AUTH0_CLIENT_SECRET} \
-e AUTH0_WEBHOOK_SECRET=${AUTH0_WEBHOOK_SECRET} \
-e AUTH0_ACTIONS_SECRET=${AUTH0_ACTIONS_SECRET} \
-e RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID} \
-e RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET} \
-e RAZORPAY_WEBHOOK_SECRET=${RAZORPAY_WEBHOOK_SECRET} \
-e DEFAULT_USER_CREDITS=${DEFAULT_USER_CREDITS:-3} \
-e SUBSCRIPTION_RECONCILIATION_ENABLED=${SUBSCRIPTION_RECONCILIATION_ENABLED:-true} \
-e OPENAI_API_KEY=${OPENAI_API_KEY} \
-e GEMINI_API_KEY=${GEMINI_API_KEY} \
-e IDEOGRAM_API_KEY=${IDEOGRAM_API_KEY} \
-e FAL_KEY=${FAL_KEY} \
-e IMAGEKIT_PUBLIC_KEY=${IMAGEKIT_PUBLIC_KEY} \
-e IMAGEKIT_PRIVATE_KEY=${IMAGEKIT_PRIVATE_KEY} \
-e IMAGEKIT_URL_ENDPOINT=${IMAGEKIT_URL_ENDPOINT} \
-e SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL} \
-e N8N_WEBHOOK_URL=${N8N_WEBHOOK_URL} \
-e N8N_JWT_SECRET=${N8N_JWT_SECRET} \
-e N8N_REQUEST_KEY=${N8N_REQUEST_KEY} \
-e N8N_GENERATION_FLOW_ID=${N8N_GENERATION_FLOW_ID} \
-e N8N_ENHANCEMENT_FLOW_ID=${N8N_ENHANCEMENT_FLOW_ID}
EOF
}

# Health check function
health_check() {
    local port=${1:-3000}
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "http://localhost:${port}/health" > /dev/null 2>&1; then
            log_success "Health check passed on attempt ${attempt}"
            return 0
        fi
        
        log_info "Health check attempt ${attempt}/${max_attempts} failed, retrying in 5 seconds..."
        sleep 5
        ((attempt++))
    done
    
    log_error "Health check failed after ${max_attempts} attempts"
    return 1
}

# Cleanup old images
cleanup_images() {
    log_info "Cleaning up old Docker images..."
    
    # Keep last 5 images
    OLD_IMAGES=$(docker images "${DOCKER_IMAGE}" --format "table {{.Repository}}:{{.Tag}}\t{{.CreatedAt}}" | tail -n +2 | sort -k2 -r | tail -n +6 | awk '{print $1}')
    
    if [ -n "$OLD_IMAGES" ]; then
        echo "$OLD_IMAGES" | xargs -r docker rmi || true
        log_success "Old images cleaned up"
    else
        log_info "No old images to clean up"
    fi
}

# Show deployment status
show_status() {
    log_info "Deployment Status:"
    echo "===================="
    echo "Environment: ${ENVIRONMENT}"
    echo "Image: ${DOCKER_IMAGE}:${IMAGE_TAG}"
    echo "Container: ${CONTAINER_NAME}"
    echo ""
    
    if docker ps -f name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -q "${CONTAINER_NAME}"; then
        log_success "Container is running:"
        docker ps -f name="${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    else
        log_error "Container is not running!"
    fi
}

# Main deployment flow
main() {
    log_info "Starting JOMO Backend Deployment"
    log_info "Environment: ${ENVIRONMENT}"
    log_info "Image Tag: ${IMAGE_TAG}"
    echo ""
    
    check_environment
    load_env_vars
    pull_image
    deploy_container
    cleanup_images
    show_status
    
    log_success "Deployment process completed!"
}

# Run main function
main "$@"