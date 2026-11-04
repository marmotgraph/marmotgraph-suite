/*
 * Copyright 2018 - 2021 Swiss Federal Institute of Technology Lausanne (EPFL)
 * Copyright 2021 - 2024 EBRAINS AISBL
 * Copyright 2024 - 2025 ETH Zurich
 *
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0.
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 *  This open source software code was developed in part or in whole in the
 *  Human Brain Project, funded from the European Union's Horizon 2020
 *  Framework Programme for Research and Innovation under
 *  Specific Grant Agreements No. 720270, No. 785907, and No. 945539
 *  (Human Brain Project SGA1, SGA2 and SGA3).
 */

package org.marmotgraph.suite.querybuilder.service;

import org.marmotgraph.suite.commons.constants.SchemaFieldsConstants;
import org.marmotgraph.suite.commons.service.ServiceCall;
import org.marmotgraph.suite.querybuilder.model.TypeEntity;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.reactive.function.BodyInserters;

import java.util.*;
import java.util.stream.Collectors;

@Component
public class TypeClient {

    private final ServiceCall kg;
    private final boolean typeReflection;

    public TypeClient(ServiceCall kg, @Value("${kg.structure.typeReflection}") boolean typeReflection) {
        this.kg = kg;
        this.typeReflection = typeReflection;
    }

    private static class KGResult extends HashMap<String, Object> {
    }

    private Map<String, Object> fetchTypes(String stage, boolean reflect) {
        String relativeUrl = String.format("types?stage=%s&withProperties=true&withIncomingLinks=true&reflect=%b", stage, reflect);
        return kg.client(true).get().uri(kg.url(relativeUrl))
                .retrieve()
                .bodyToMono(KGResult.class)
                .block();
    }

    private Map<String, Map<String, String>> reverseLinkMap(Collection<?> types){
        Map<String, Map<String, String>> result = new HashMap<>();
        types.stream().map(t -> (Map<?,?>)t).forEach(t -> {
            Map<String, String> reverseLinkPerProperty = new HashMap<>();
            Object properties = t.get(SchemaFieldsConstants.META_PROPERTIES);
            if(properties instanceof List){
                ((List<?>)properties).stream().map(p -> (Map<?,?>)p).forEach(p -> {
                    Object reverseLink = p.get(SchemaFieldsConstants.META_NAME_REVERSE_LINK);
                    if(reverseLink instanceof String) {
                        reverseLinkPerProperty.put((String) p.get(SchemaFieldsConstants.IDENTIFIER), (String) reverseLink);
                    }
                });
            }
            if(!reverseLinkPerProperty.isEmpty()){
                result.put((String)t.get(SchemaFieldsConstants.IDENTIFIER), reverseLinkPerProperty);
            }
        });
        return result;
    }


    public List<TypeEntity> getTypes() {
        Map<String, Object> resultInProgress = fetchTypes("IN_PROGRESS", typeReflection);
        if (resultInProgress != null) {
            Map<String, Object> resultReleased = fetchTypes("RELEASED", typeReflection);
            if (resultReleased != null) {
                Object dataInProgress = resultInProgress.get("data");
                Object dataReleased = resultReleased.get("data");
                if (dataInProgress instanceof Collection && dataReleased instanceof Collection) {
                    Map<String, Map<String, String>> reverseLinkMap = reverseLinkMap((Collection<?>) dataInProgress);
                    final Map<String, TypeEntity> inProgressTypes = ((Collection<?>) dataInProgress).stream().filter(d -> d instanceof Map).map(d -> (Map<?, ?>) d).map(d -> TypeEntity.fromMap(d, reverseLinkMap)).collect(Collectors.toMap(TypeEntity::getId, v -> v));
                    final Map<String, TypeEntity> releasedTypes = ((Collection<?>) dataReleased).stream().filter(d -> d instanceof Map).map(d -> (Map<?, ?>) d).map(d -> TypeEntity.fromMap(d, reverseLinkMap)).collect(Collectors.toMap(TypeEntity::getId, v -> v));
                    List<TypeEntity> result = new ArrayList<>();
                    inProgressTypes.keySet().forEach(k -> {
                        final TypeEntity entity = inProgressTypes.get(k);
                        if (releasedTypes.containsKey(k)) {
                            entity.mergeWith(releasedTypes.get(k));
                        }
                        result.add(entity);
                    });
                    //Add all types which only exist in released
                    releasedTypes.keySet().forEach(k -> {
                        if (!inProgressTypes.containsKey(k)) {
                            result.add(releasedTypes.get(k));
                        }
                    });
                    result.sort(Comparator.comparing(TypeEntity::getLabel));
                    return result;
                }
            }
        }
        return Collections.emptyList();
    }

    public Map<?, ?> getTypesByName(List<String> types) {
        String relativeUrl = "typesByName?stage=IN_PROGRESS&withProperties=true&withIncomingLinks=true";
        Map result = kg.client(true).post().uri(kg.url(relativeUrl))
                .body(BodyInserters.fromValue(types))
                .retrieve()
                .bodyToMono(Map.class)
                .block();
        if (result != null) {
            Map<?, ?> data = (Map<?, ?>) result.get("data");
            Map<String, Map<String, String>> reverseLinkMap = reverseLinkMap((Collection<?>) fetchTypes("IN_PROGRESS", false).get("data")); //We need the type information solely for the reverse link information. No reflection needed.
            return data.entrySet().stream().collect(Collectors.toMap(Map.Entry::getKey, d -> TypeEntity.fromMap(this.getData(d), reverseLinkMap)));
        }
        return Collections.emptyMap();
    }

    private Map<?, ?> getData(Map.Entry data) {
        return (Map<?, ?>) ((Map<?, ?>) data.getValue()).get("data");
    }
}
