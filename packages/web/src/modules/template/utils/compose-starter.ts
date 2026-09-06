export const COMPOSE_STARTER = `services:
  web:
    image: nginx:1.27
    ports:
      - "80"
    environment:
      API_URL: http://api:9000
    depends_on:
      - api

  api:
    image: ghcr.io/your-org/api:latest
    environment:
      PORT: "9000"
    volumes:
      - data:/var/lib/api
`;
