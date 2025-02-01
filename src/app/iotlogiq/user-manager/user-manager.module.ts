import { NgModule } from "@angular/core";
import { StoreModule } from "@ngrx/store";
import { userManagerReducer } from "./reducers/user-manager.reducer";

@NgModule({
    imports: [StoreModule.forFeature({
        name: "user",
        reducer: userManagerReducer})
    ]
})
export class UserManagerModule {};
