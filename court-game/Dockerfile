FROM nginx:stable-alpine
ARG SOURCE_REVISION=local
LABEL org.opencontainers.image.source="https://github.com/1ch666/eduai2" \
      org.opencontainers.image.revision="${SOURCE_REVISION}" \
      org.opencontainers.image.title="EduAI Court WebGL"
# Build context is the repository root. Default: deployed WebGL output in play/.
# To package an un-deployed local build, pass --build-arg WEB_ROOT=court-game/Builds/WebGL.
ARG WEB_ROOT=play
COPY court-game/docker/nginx.conf /etc/nginx/nginx.conf
COPY --chown=nginx:nginx ${WEB_ROOT}/ /usr/share/nginx/html/
RUN test -s /usr/share/nginx/html/index.html \
    && test -s /usr/share/nginx/html/touch-controls.js \
    && test -s /usr/share/nginx/html/Build/WebGL.loader.js \
    && for asset in WebGL.data.unityweb WebGL.wasm.unityweb WebGL.framework.js.unityweb; do \
         test -s "/usr/share/nginx/html/Build/$asset" \
         && gzip -t "/usr/share/nginx/html/Build/$asset" || exit 1; \
       done
USER nginx
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1
CMD ["nginx", "-g", "daemon off;"]
