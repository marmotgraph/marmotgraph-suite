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

package org.marmotgraph.suite.commons.controller;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class IdControllerTest {

    private CoreController coreController = Mockito.mock(CoreController.class);


    private IdController controller;

    @BeforeEach
    void setUp() {
        Mockito.doReturn(Map.of("idNamespace", "http://foobar/")).when(coreController).getTenantInformation();
        controller = new IdController(coreController);
    }


    @Test
    void simplifyFullyQualifiedId() {
        //given
        String toTest = "http://foobar/1bda8d6d-7333-42f5-aff5-32c87dceffbf";

        //when
        UUID uuid = controller.simplifyFullyQualifiedId(toTest);

        //then
        assertNotNull(uuid);

    }

    @Test
    void simplifyFullyQualifiedIdWrongPrefix() {

        //given
        String toTest = "http://barfoo/1bda8d6d-7333-42f5-aff5-32c87dceffbf";

        //when
        UUID uuid = controller.simplifyFullyQualifiedId(toTest);

        //then
        assertNull(uuid);

    }


    @Test
    void simplifyFullyQualifiedIdWrongUUID() {

        //given
        String toTest = "http://foobar/abc";

        //when
        UUID uuid = controller.simplifyFullyQualifiedId(toTest);

        //then
        assertNull(uuid);

    }


    @Test
    void fullyQualifyAtId() {
        //Given
        String randomUUID = "e7fb54ee-1b68-4f76-9bcd-b3a72903c7fd";
        Map<String, Object> atId = new HashMap<>();
        atId.put("@id", randomUUID);

        Map<String, Object> toTest = new HashMap<>();
        Map<String, Object> nested = new HashMap<>();
        nested.put("http://foobarNestedObj", atId);
        nested.put("http://foobarNestedArrayObj", Collections.singletonList(atId));

        toTest.put("http://foobarString", "testSimple");
        toTest.put("http://foobarArray", Arrays.asList("1", "2"));
        toTest.put("http://foobarObject", atId);

        toTest.put("http://foobarNested", nested);
        toTest.put("http://foobarNestedArray", nested);

        //When
        Map<?, ?> result = controller.fullyQualifyAtId(toTest);
        Map<String, Object> r = (Map<String, Object>) result.get("http://foobarNested");
        Object n = ((Map<String, Object>) r.get("http://foobarNestedObj")).get("@id");
        String expected = String.format("http://foobar/%s", randomUUID);

        //Then
        assertEquals(expected, n);
    }
}