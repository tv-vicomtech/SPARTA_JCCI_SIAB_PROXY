# Requirements

- [Sparta JCCI NODE](https://github.com/tv-vicomtech/SPARTA_JCCI_NODE)
- A machine with Internet access, public IP or domain, and possibility of opening ports.
- HTTPS certificates for the public domain.
- Another machine with ShellInAbox installed and started: $ sudo apt update && sudo apt install -y shellinabox && shellinabox -k   
- First and second machine must be able to comunicate with eachother, they must be in the same network, or they can even be the same machine (althought it is not recommended).

# Steps-to-follow

1. Git clone this project in the machine with the public IP or domain and HTTPS certs.

2. Copy HTTPS certificates to folder vicomlab-certs/

3. Change cert files names if necessary, so that they coincide with Dockerfile references.

4. Change the parameters in .env file:
    - SPARTA_HOST=private IP of the machine running ShellInAbox
    - SPARTA_PORT=port running ShellInABox
    - KEYROCK_HOST=https://jcci.sparta.eu
    - KEYROCK_PORT=4443
    - AUTHZFORCE_HOST=https://jcci.sparta.eu
    - AUTHZFORCE_PORT=8443
    - Choose port to serve proxy in and configure it: SPARTA_PROXY_HTTPS_PORT=
    
5. Ask for PEP Proxy credentials to SPARTA Access Control System managers (jafernandez@vicomtech.org, fzola@vicomtech.org) and write Proxy credentials to communicate with Sparta IdM in .env file

6. Update node interaction data json field to add information about new service available

7. Start the service: $ sudo docker-compose up --build

# Result

By entering in the Sparta JCCI website and logging in, if the user has permissions, it must be able to enter the partner node information, click on interactive and then, see an URL to access the landing host serving the ShellInABox through a Proxy. By clicking over it, access should be granted.
