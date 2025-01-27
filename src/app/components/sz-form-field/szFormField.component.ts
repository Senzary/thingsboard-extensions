import { Component, Input, OnInit } from "@angular/core";
import { FormField } from "../../utils/public-api";
import { FormGroup } from "@angular/forms";

@Component({
    selector: 'tb-sz-form-field',
    templateUrl: './szFormField.component.html',
    styleUrls: [
        './szFormField.component.scss'
    ]
})
export class SZFormFieldComponent implements OnInit {
    @Input() fields: FormField[];
    @Input() formGroup: FormGroup;

    constructor() {};
    addChip
    ngOnInit(): void {
        
    }
}