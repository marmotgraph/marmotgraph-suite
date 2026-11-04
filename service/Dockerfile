FROM eclipse-temurin:26-jre-alpine
VOLUME /tmp
COPY target/*.jar kg-suite.jar
ENV JAVA_OPTS=""
ENTRYPOINT exec java $JAVA_OPTS -jar /kg-suite.jar