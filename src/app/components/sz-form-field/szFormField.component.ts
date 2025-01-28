import { ChangeDetectorRef, Component, Input, OnChanges, OnInit, SimpleChanges } from "@angular/core";
import { FormField } from "../../utils/public-api";
import { FormControl, FormGroup } from "@angular/forms";
import { MatChipEditedEvent, MatChipInputEvent } from "@angular/material/chips";

@Component({
    selector: 'tb-sz-form-field',
    templateUrl: './szFormField.component.html',
    styleUrls: [
        './szFormField.component.scss'
    ]
})
export class SZFormFieldComponent implements OnInit, OnChanges {
    @Input() field: FormField;
    @Input() formGroup: FormGroup;
    @Input() control: FormControl;
    private changeDetection: ChangeDetectorRef;
    constructor(changeDetection: ChangeDetectorRef) {
        this.changeDetection = changeDetection
    };
    ngOnInit(): void {
        console.log('>>> 🤍 on fieldset init', this.control, this.field);
    }
    addChip(event: MatChipInputEvent) {
        const currentChips: string[] = this.control.value;
        const newChip = event.value.trim()
        if (!newChip) return;
        currentChips.push(newChip);
        this.control.setValue(currentChips);
        event.chipInput.clear();
    };
    editChip(event: MatChipEditedEvent, chip: string) {
        const currentChips: string[] = this.control.value;
        const newChip = event.value.trim()
        if (!newChip) return;
        const editedChips = currentChips.map((c) => {
            if (c === chip) return newChip;
            return c;
        });
        this.control.setValue(editedChips);
    };
    removeChip(chip: string, fieldName: string) {
        const currentChips: string[] = this.control.value;
        this.control.setValue(currentChips.filter(c => c !== chip));
    };
    ngOnChanges(changes: SimpleChanges): void {
        console.log('>>> 💙 changes:', changes, this.field);
        this.changeDetection.detectChanges();
    }
}