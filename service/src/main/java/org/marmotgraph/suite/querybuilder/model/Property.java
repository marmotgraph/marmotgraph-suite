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

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Getter
@Setter
public class Property {
    private String simpleAttributeName;
    private String attribute;
    private String label;
    private List<String> canBe;
    private Boolean reverse;

    public Property(String simpleAttributeName, String attribute, String label, List<String> canBe) {
        this.simpleAttributeName = simpleAttributeName;
        this.attribute = attribute;
        this.label = label;
        this.canBe = canBe;
    }

    public Property(String simpleAttributeName, String attribute, String label, List<String> canBe, Boolean reverse) {
        this.simpleAttributeName = simpleAttributeName;
        this.attribute = attribute;
        this.label = label;
        this.canBe = canBe;
        this.reverse = reverse;
    }

    public static Property fromMap(Map d) {
        String attribute = (String) (d.get(SchemaFieldsConstants.IDENTIFIER));
        String simpleAttributeName = extractSimpleAttributeName(attribute);
        String label = (String) (d.get(SchemaFieldsConstants.NAME));
        List<Map<String, Object>> canBeMap = (List<Map<String, Object>>) d.get(SchemaFieldsConstants.META_TARGET_TYPES);
        List<String> canBe = null;
        if (canBeMap != null) {
            canBe = canBeMap.stream().map(p -> (String) p.get(SchemaFieldsConstants.META_TYPE)).collect(Collectors.toList()); // NOSONAR
        }
        return new Property(simpleAttributeName, attribute, label, canBe);
    }

    public static Property fromIncomingLinksMap(Map d, Map<String, Map<String, String>> reverseLinkMap) {
        String attribute = (String) (d.get(SchemaFieldsConstants.IDENTIFIER));
        String simpleAttributeName = extractSimpleAttributeName(attribute);
        List<Map<String, Object>> canBeMap = (List<Map<String, Object>>) d.get(SchemaFieldsConstants.META_SOURCE_TYPES);
        List<String> canBe = null;
        String label=(String) d.get(SchemaFieldsConstants.NAME);
        if (canBeMap != null) {
            Optional<String> reverseLinkLabel = canBeMap.stream().map(f -> {
                String type = (String) f.get(SchemaFieldsConstants.META_TYPE);
                Map<String, String> fromReverseLinkMap = reverseLinkMap.get(type);
                if (fromReverseLinkMap != null) {
                    return Optional.ofNullable(fromReverseLinkMap.get(attribute));
                }
                return Optional.<String>empty();
            }).filter(Optional::isPresent).findFirst().orElse(Optional.empty());
            label = reverseLinkLabel.orElse(label);
            canBe = canBeMap.stream().map(p -> (String) p.get(SchemaFieldsConstants.META_TYPE)).collect(Collectors.toList()); // NOSONAR
        }
        return new Property(simpleAttributeName, attribute, label, canBe, true);
    }

    private static String extractSimpleAttributeName(String attribute) {
        String simpleAttributeName;
        if (attribute.startsWith("@")) {
            simpleAttributeName = attribute.replace("@", "");
        } else {
            String[] splittedAttribute = attribute.split("/");
            simpleAttributeName = splittedAttribute[splittedAttribute.length - 1];
        }
        return simpleAttributeName;
    }

    public void merge(Property p) {
        if (p != null) {
            if (this.getCanBe() != null && p.getCanBe() != null) {
                this.getCanBe().addAll(p.getCanBe());
                this.setCanBe(this.getCanBe().stream().distinct().sorted().collect(Collectors.toList())); // NOSONAR
            } else if (p.getCanBe() != null) {
                this.setCanBe(p.getCanBe());
            }
        }
    }

}
