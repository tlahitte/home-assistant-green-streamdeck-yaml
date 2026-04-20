FROM alpine:3.23

RUN apk add --no-cache \
        bash \
        jq \
        python3 \
        py3-pip \
        libusb \
        hidapi \
        cairo \
        libffi \
        libxml2 \
        libxslt \
        libjpeg-turbo \
        libpng \
        libwebp \
        freetype \
        eudev \
    && apk add --no-cache --virtual .build-deps \
        python3-dev \
        gcc \
        musl-dev \
        hidapi-dev \
        libusb-dev \
        cairo-dev \
        libffi-dev \
        libxml2-dev \
        libxslt-dev \
        libjpeg-turbo-dev \
        libpng-dev \
        libwebp-dev \
        freetype-dev \
    && pip3 install --no-cache-dir --break-system-packages \
        streamdeck \
        cairosvg \
        jinja2 \
        lxml \
        Pillow \
        "pydantic<2" \
        python-dotenv \
        pyyaml \
        requests \
        rich \
        websockets \
    && apk del .build-deps

ENV SETUPTOOLS_SCM_PRETEND_VERSION=1.0.0

WORKDIR /app
COPY . /app/
RUN pip3 install --no-cache-dir --no-deps --break-system-packages -e .

COPY run.sh /run.sh
RUN chmod a+x /run.sh

CMD ["/run.sh"]
