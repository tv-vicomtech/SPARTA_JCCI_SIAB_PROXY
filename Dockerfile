# Use the official image as a parent image.
FROM fiware/pep-proxy:7.8.1

# Set the working directory.
WORKDIR /opt/fiware-pep-proxy

# Copy modified files
COPY server.js /opt/fiware-pep-proxy/server.js
COPY root.js /opt/fiware-pep-proxy/controllers/root.js

# Create shellinabox source code directory
RUN mkdir shellinabox

# Copy modified shellinabox files
COPY root_page.html /opt/fiware-pep-proxy/shellinabox/root_page.html
COPY ShellInABox.js /opt/fiware-pep-proxy/shellinabox/ShellInABox.js

# Run the command inside your image filesystem.
RUN sed -i "s|cert/cert.crt|cert/cert.pem|g" /opt/fiware-pep-proxy/config.js
RUN sed -i "s|cert/key.key|cert/privakey.pem|g" /opt/fiware-pep-proxy/config.js
RUN sed -i -e "/privakey.pem/a\\  ca_cert: \['cert/chain.pem', 'cert/fullchain.pem'\]," /opt/fiware-pep-proxy/config.js