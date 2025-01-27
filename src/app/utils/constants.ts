import { CompanyHierarchy, CompanyHierarchyPayload } from "./types";

export const COMPANY_HIERARCHIES: Record<CompanyHierarchy, CompanyHierarchyPayload> = {
    [CompanyHierarchy.PARTNER]: {
        label: "Partner",
        groupName: "partners",
        mayHave: [
            CompanyHierarchy.DISTRITBUTOR,
            CompanyHierarchy.INTEGRATOR,
            CompanyHierarchy.CLIENT
        ]
    },
    [CompanyHierarchy.DISTRITBUTOR]: {
        label: "Distributor",
        groupName: "distributors",
        mayHave: [
            CompanyHierarchy.INTEGRATOR,
            CompanyHierarchy.CLIENT
        ]
    },
    [CompanyHierarchy.INTEGRATOR]: {
        label: "Integrator",
        groupName: "integrators",
        mayHave: [
            CompanyHierarchy.CLIENT
        ]
    },
    [CompanyHierarchy.CLIENT]: {
        label: "Client",
        groupName: "clients",
        mayHave: [
            CompanyHierarchy.CLIENT, 
            CompanyHierarchy.ENTITY
        ]
    },
    [CompanyHierarchy.ENTITY]: {
        label: "Entity",
        groupName: "entities",
        mayHave: []
    }
};

export const ZIP_CODE_PATTERNS: Record<string, string> = {
    "United States": "(\\d{5}([\\-]\\d{4})?)",
    Australia: "[0-9]{4}",
    Austria: "[0-9]{4}",
    Belgium: "[0-9]{4}",
    Brazil: "[0-9]{5}[\\-]?[0-9]{3}",
    Canada: "^(?!.*[DFIOQU])[A-VXY][0-9][A-Z][ -]?[0-9][A-Z][0-9]$",
    Denmark: "[0-9]{3,4}",
    "Faroe Islands": "[0-9]{3,4}",
    Netherlands: "[1-9][0-9]{3}\\s?[a-zA-Z]{2}",
    Germany: "[0-9]{5}",
    Hungary: "[0-9]{4}",
    Italy: "[0-9]{5}",
    Japan: "\\d{3}-\\d{4}",
    Luxembourg: "(L\\s*(-|—|–))\\s*?[\\d]{4}",
    Poland: "[0-9]{2}\\-[0-9]{3}",
    Spain: "((0[1-9]|5[0-2])|[1-4][0-9])[0-9]{3}",
    Sweden: "\\d{3}\\s?\\d{2}",
    "United Kingdom": "[A-Za-z]{1,2}[0-9Rr][0-9A-Za-z]? [0-9][ABD-HJLNP-UW-Zabd-hjlnp-uw-z]{2}",
};
