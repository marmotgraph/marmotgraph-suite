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

package org.marmotgraph.suite.querybuilder.model;

import lombok.Getter;
import lombok.Setter;
import org.marmotgraph.suite.commons.constants.SchemaFieldsConstants;

import java.util.*;
import java.util.stream.Collectors;

@Getter
@Setter
public class TypeEntity {
    private String id;
    private String label;
    private String color;
    private String description;
    private List<Property> properties;

    public TypeEntity(String id, String label, String color, String description, List<Property> properties) {
        this.id = id;
        this.label = label;
        this.color = color;
        this.description = description;
        this.properties = properties;
    }

    public static TypeEntity fromMap(Map d, Map<String, Map<String, String>> reverseLinkMap) {
        String id = (String) (d.get(SchemaFieldsConstants.IDENTIFIER));
        String name = (String) (d.get(SchemaFieldsConstants.NAME));
        String color = (String) (d.get(SchemaFieldsConstants.META_COLOR));
        String description = (String) (d.get(SchemaFieldsConstants.DESCRIPTION));
        List<Property> properties = ((Collection<?>) d.get(SchemaFieldsConstants.META_PROPERTIES)).stream()
                .filter(Map.class::isInstance)
                .map(p -> Property.fromMap((Map<?, ?>) p))
                .collect(Collectors.toList());
        List<Property> incomingLinksProperties = ((Collection<?>) d.get(SchemaFieldsConstants.META_INCOMING_LINKS)).stream()
                .filter(Map.class::isInstance)
                .map(p -> Property.fromIncomingLinksMap((Map<?, ?>) p, reverseLinkMap))
                .collect(Collectors.toList()); // NOSONAR
        properties.addAll(incomingLinksProperties);
        return new TypeEntity(id, name, color, description, properties);
    }

    private String getDistinctPropertyKey(Property p) {
        return String.format("%s-%b", p.getAttribute(), p.getReverse());
    }

    public void mergeWith(TypeEntity typeEntity) {
        final Map<String, Property> mappedProperties = typeEntity.getProperties().stream().collect(Collectors.toMap(this::getDistinctPropertyKey, v -> v));
        Set<String> handledProperties = new HashSet<>();
        this.properties.forEach(p -> {
            final String distinctPropertyKey = getDistinctPropertyKey(p);
            if (mappedProperties.containsKey(distinctPropertyKey)) {
                p.merge(mappedProperties.get(distinctPropertyKey));
            }
            handledProperties.add(p.getAttribute());
        });
        typeEntity.getProperties().stream().filter(p -> !handledProperties.contains(p.getAttribute())).forEach(p -> this.properties.add(p));
    }

}
