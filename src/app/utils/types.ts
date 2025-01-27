export enum CompanyHierarchy {
    PARTNER = "partner",
    DISTRITBUTOR = "distributor",
    INTEGRATOR = "integrator",
    CLIENT = "client",
    ENTITY = "entity"
};

export enum SmartIndustryBusinessUnit {
    IOT_COMMERCIAL = "iot-commercial",
    DUST_CONTROL = "dust-iq",
    PREDICTIVE_CARE = "predictive-care",
    DATA_CENTERS = "data-centers",
    ENVIRONMENT_IQ = "environment-iq",
    SMART_AIRPORT = "smart-airport",
    AQUIFER_MONITORING = "aquifer-monitoring",
    BAGHOUSE_MONITORING = "baghouse-monitoring"
};

export type SZDropdownItem<T extends Record<never, never>> = {
    label: string;
    value: T;
};

export type CompanyHierarchyPayload = {
    label: string;
    groupName: string;
    mayHave: CompanyHierarchy[]
};

export type FieldInputType = "input" | 
    "text-area" | 
    "map" | 
    "image" | 
    "select" | 
    "multi-select" | 
    "chips";

export type FieldDataType = "integer" | 
    "double" | 
    "string" | 
    "array" | 
    "json" | 
    "enum"; 

export type FieldSpecialType = "map-coordinates" | 
    "map-perimeter" | 
    "image-floorplan" | 
    "image-commercial";

export type FormField = {
    name: string;
    required?: boolean;
    editableInForms?: boolean;
    hideInForms?: boolean;
    bulk?: boolean;
    order?: number;
    label?: string;
    type?: FieldDataType;
    input?: FieldInputType;
    specialType?: FieldSpecialType;
    validations?: Record<never, never>;
    description?: string;
    enumOptions?: string[];
    selectOptions?: SZDropdownItem<any>[];
    default?: {
        value: any;
        unit: string;
    };
};
