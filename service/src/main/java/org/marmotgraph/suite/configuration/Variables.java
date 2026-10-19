package org.marmotgraph.suite.configuration;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.info.GitProperties;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public record Variables(@Value("${org.marmotgraph.tenant}") String tenant, @Value("${org.marmotgraph.core}") String kgEndpoint, @Value("${org.marmotgraph.assetCache.refreshInterval}") Integer assetCacheRefreshInterval, @Value("${org.marmotgraph.core.connection.maxRetries}") Integer coreConnectionMaxRetries, @Value("${org.marmotgraph.core.connection.retryInterval}") Integer coreConnectionRetryInterval, ObjectProvider<GitProperties> gitProperties) {


    public Optional<String> shortCommitId(){
        return Optional.ofNullable(gitProperties().getIfAvailable()).map(GitProperties::getShortCommitId);
    }

}
