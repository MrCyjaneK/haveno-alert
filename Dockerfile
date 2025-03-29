FROM --platform=linux/amd64 ubuntu:24.04 

ENV DEBIAN_FRONTEND=noninteractive

RUN apt update && apt install -y \
    make \
    wget \
    git \
    curl \
    unzip \
    zip \
    sudo \
    gnupg2 \
    lsb-release \
    wget \
    && rm -rf /var/lib/apt/lists/*

RUN wget -O- https://apt.envoyproxy.io/signing.key | gpg --dearmor -o /etc/apt/keyrings/envoy-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/envoy-keyring.gpg] https://apt.envoyproxy.io bookworm main" | tee /etc/apt/sources.list.d/envoy.list && \
    apt update && apt install -y envoy && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt install -y nodejs && \
    npm install -g npm@latest

WORKDIR /workspace

RUN useradd -m -s /bin/bash vscode
RUN chown -R vscode:vscode /workspace
RUN usermod -aG sudo vscode && \
    echo "vscode ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/vscode && \
    chmod 0440 /etc/sudoers.d/vscode

USER vscode

RUN curl -s "https://get.sdkman.io" | bash
RUN bash -c "source $HOME/.sdkman/bin/sdkman-init.sh && sdk install java 21.0.2.fx-librca"

ENV SDKMAN_DIR="/home/vscode/.sdkman"
ENV PATH="${PATH}:${SDKMAN_DIR}/candidates/java/current/bin"

RUN echo "source \$HOME/.sdkman/bin/sdkman-init.sh" >> $HOME/.bashrc && \
    echo "source \$HOME/.sdkman/bin/sdkman-init.sh" >> $HOME/.profile

SHELL ["/bin/bash", "-l", "-c"]
ENTRYPOINT ["/bin/bash", "-l", "-c"]

CMD ["/bin/bash", "-l"] 