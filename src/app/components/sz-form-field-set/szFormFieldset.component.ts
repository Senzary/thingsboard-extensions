import { ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { FormField } from "../../utils/public-api";
import { AbstractControl, FormControl, FormGroup } from "@angular/forms";
import { MatChipEditedEvent, MatChipInputEvent } from "@angular/material/chips";

@Component({
    selector: 'tb-sz-form-fieldset',
    templateUrl: './szFormFieldset.component.html',
    styleUrls: [
        './szFormFieldset.component.scss'
    ]
})
export class SZFormFiedsetComponent implements OnInit, OnChanges {
    @Input() fields: FormField[];
    @Input() formGroup: FormGroup;
    private changeDetection: ChangeDetectorRef;
    constructor(changeDetection: ChangeDetectorRef) {
        this.changeDetection = changeDetection
    };
    ngOnInit(): void {
        console.log('>>> 🤍 on fieldset init', this.fields);
    }
    addChip(event: MatChipInputEvent, fieldName: string) {
        const currentChips: string[] = this.formGroup
            .get(fieldName)
            .value;
        const newChip = event.value.trim()
        if (!newChip) return;
        currentChips.push(newChip);
        this.formGroup
            .get(fieldName)
            .setValue(currentChips);
        event.chipInput.clear();
    };
    editChip(event: MatChipEditedEvent, chip: string, fieldName: string) {
        const currentChips: string[] = this.formGroup
            .get(fieldName)
            .value;
        const newChip = event.value.trim()
        if (!newChip) return;
        const editedChips = currentChips.map((c) => {
            if (c === chip) return newChip;
            return c;
        });
        this.formGroup
            .get(fieldName)
            .setValue(editedChips);
    };
    removeChip(chip: string, fieldName: string) {
        const currentChips: string[] = this.formGroup
            .get(fieldName)
            .value;
        this.formGroup
            .get(fieldName)
            .setValue(currentChips.filter(c => c !== chip));
    };
    ngOnChanges(changes: SimpleChanges): void {
        console.log('>>> 💙 changes:', changes, this.fields);
        this.changeDetection.detectChanges();
    }
}