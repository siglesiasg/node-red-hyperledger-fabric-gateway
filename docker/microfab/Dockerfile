FROM ibmcom/ibp-microfab:0.0.16

USER 0

# Repo fix
RUN rm -f /etc/yum.repos.d/bintray-apache-couchdb-rpm.repo
RUN microdnf install dos2unix

WORKDIR /home/ibp-user
# RUN mkdir fabcar-chaincode-go-main

COPY ./install.sh /home/ibp-user/install.sh
COPY ./docker-entrypoint.sh /home/ibp-user/docker-entrypoint.sh
COPY ./fabric-config.json /home/ibp-user/fabric-config.json
COPY ./fabcar-chaincode-go-main /home/ibp-user/fabcar-chaincode-go-main

RUN dos2unix /home/ibp-user/*.sh

RUN chmod +x /home/ibp-user/*.sh
RUN chown -R 7051:7051 /home/ibp-user

USER 7051

EXPOSE 9999
VOLUME /opt/microfab/data

ENTRYPOINT [ "/tini", "--", "/home/ibp-user/docker-entrypoint.sh" ]

