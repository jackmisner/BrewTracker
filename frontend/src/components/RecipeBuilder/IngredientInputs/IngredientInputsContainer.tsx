import FermentableInput from "@/components/RecipeBuilder/IngredientInputs/FermentableInput";
import HopInput from "@/components/RecipeBuilder/IngredientInputs/HopInput";
import YeastInput from "@/components/RecipeBuilder/IngredientInputs/YeastInput";
import OtherInput from "@/components/RecipeBuilder/IngredientInputs/OtherInput";
import React from "react";
import {
  IngredientsByType,
  IngredientFormData,
  IngredientType,
  CreateRecipeIngredientData,
} from "@/types";

interface IngredientInputsContainerProps {
  ingredients: IngredientsByType;
  addIngredient: (
    type: IngredientType,
    data: CreateRecipeIngredientData
  ) => Promise<void>;
  disabled?: boolean;
}

const IngredientInputsContainer: React.FC<IngredientInputsContainerProps> = ({
  ingredients,
  addIngredient,
  disabled = false,
}) => {
  return (
    <div className="ingredient-inputs-container">
      <div className="grid-col-2-3">
        <FermentableInput
          grains={ingredients.grain}
          onAdd={(data: IngredientFormData) =>
            addIngredient("grain", {
              ingredient_id: data.ingredient_id,
              amount: data.amount,
              unit: data.unit,
              use: data.use || "mash",
              color: data.color ? parseFloat(data.color) : undefined,
            })
          }
          disabled={disabled}
        />
      </div>

      <HopInput
        hops={ingredients.hop}
        onAdd={(data: IngredientFormData) =>
          addIngredient("hop", {
            ingredient_id: data.ingredient_id,
            amount: data.amount,
            unit: data.unit,
            use: data.use,
            time: data.time
              ? typeof data.time === "string"
                ? parseFloat(data.time)
                : data.time
              : undefined,
            alpha_acid: data.alpha_acid
              ? parseFloat(data.alpha_acid)
              : undefined,
          })
        }
        disabled={disabled}
      />

      <YeastInput
        yeasts={ingredients.yeast}
        onAdd={(data: IngredientFormData) =>
          addIngredient("yeast", {
            ingredient_id: data.ingredient_id,
            amount: data.amount,
            unit: data.unit,
            use: data.use || "fermentation",
          })
        }
        disabled={disabled}
      />

      <OtherInput
        others={
          ingredients.other?.length
            ? ingredients.other
            : (ingredients as any).adjunct || []
        }
        onAdd={(data: IngredientFormData) =>
          addIngredient("other", {
            ingredient_id: data.ingredient_id,
            amount: data.amount,
            unit: data.unit,
            use: data.use || "boil",
          })
        }
        disabled={disabled}
      />
    </div>
  );
};

export default IngredientInputsContainer;
