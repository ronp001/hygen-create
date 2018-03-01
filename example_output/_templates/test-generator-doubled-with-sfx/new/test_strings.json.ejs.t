---
to: test_strings.json
---
{
    "about this file": [
        "This file is used by src/__integration_tests__/integration.test.ts",
        "Each entry in here is an array of two strings.",
        "The first string (<string1>) is intended to be the value input for the 'hygen-create usename <string1>' command",
        "The second (<string2>) is the expected value after running the resulting generator with --name <string2>"
    ],
    "about the sections": [
        "Each section has a 'defs' entry with two definitions:  'hygen-create usename' and 'hygen --name",
        "When the following command sequence is run:",
            "  $ hygen-create start test-generator",
            "  $ hygen-create usename <hygen-create-usename from the defs section>",
            "  $ hygen-create add test_strings.json",
            "  $ hygen-create generate",
            "  $ hygen test-generator new --name <hygen-name from the defs section>",
            "The expected result in the created file:",
            "  The first string is expected to become identical to the second",
            "  The second string should remain as it was in the original file"
    ],
    "plain": {
        "defs": {
            "hygen-create usename": "word",
            "hygen --name": "result"
        },
        "comparisons": {
            "plain": ["word", "result"],
            "capitalized": ["Word", "Result"],
            "allcaps": ["WORD", "RESULT"],
            "with_preceding_underscore": ["_word", "_result"],
            "with_preceding_underscore_capitalized": ["_Word", "_Result"],
            "with_preceding_dash": ["-word", "-result"],
            "with_preceding_dash_capitalized": ["-Word", "-Result"],
            "with_preceding_word_capitalized": ["ClsWord","ClsWord", "not converted"]
        }
    },
    "doubled-no-sfx": {
        "defs": {
            "hygen-create usename": "<%= h.inflection.camelize(name, false) %>",
            "hygen --name": "TheResult"
        },
        "comparisons": {
            "underscore": ["<%= h.inflection.underscore(name, false) %>","the_result"],
            "underscore_with_preceding_underscore": ["_<%= h.inflection.underscore(name, false) %>","_the_result"],
            "camelcased": ["<%= h.inflection.camelize(name, false) %>","TheResult"],
            "camelcased_with_preceding_underscore": ["_<%= h.inflection.camelize(name, false) %>", "_TheResult"],
            "camelcased_lowerfirst": ["<%= h.inflection.camelize(name, true) %>", "theResult"],
            "dashed": ["<%= h.inflection.transform(name, ['underscore','dasherize']) %>", "the-result"],
            "dashed_with_preceding_dash": ["-<%= h.inflection.transform(name, ['underscore','dasherize']) %>", "-the-result"],
            "underscore_all_caps": ["<%= h.inflection.underscore(name, false).toUpperCase() %>", "THE_RESULT"]
        }
    },
    "doubled-with-sfx": {
        "defs": {
            "hygen-create usename": "<%= h.inflection.camelize(name, false) %>",
            "hygen --name": "TheResult"
        },
        "comparisons": {
            "underscore": ["<%= h.inflection.underscore(name, false) %>_with_sfx","the_result_with_sfx"],
            "underscore_with_preceding_underscore": ["_<%= h.inflection.underscore(name, false) %>_with_sfx","_the_result_with_sfx"],
            "camelcased": ["<%= h.inflection.camelize(name, false) %>WithSfx","TheResultWithSfx"],
            "camelcased_with_preceding_underscore": ["_<%= h.inflection.camelize(name, false) %>WithSfx","_TheResultWithSfx"],
            "camelcased_lowerfirst": ["<%= h.inflection.camelize(name, true) %>WithSfx","theResultWithSfx"],
            "dashed": ["<%= h.inflection.transform(name, ['underscore','dasherize']) %>-with-sfx","the-result-with-sfx"],
            "dashed_with_preceding_dash": ["-<%= h.inflection.transform(name, ['underscore','dasherize']) %>-with-sfx","-the-result-with-sfx"],
            "underscore_all_caps": ["<%= h.inflection.underscore(name, false).toUpperCase() %>_WITH_SFX","THE_RESULT_WITH_SFX"]
        }
    }
}