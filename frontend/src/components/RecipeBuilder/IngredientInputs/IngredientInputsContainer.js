import FermentableInput from "./FermentableInput";
import HopInput from "./HopInput";
import YeastInput from "./YeastInput";
import OtherInput from "./OtherInput";

function IngredientInputsContainer({
  ingredients,
  addIngredient,
  disabled = false,
}) {
  return (
    <div className="ingredient-inputs-container">
      <div className="grid-col-2-3">
        <FermentableInput
          grains={ingredients.grain}
          onAdd={(data) => addIngredient("grain", data)}
          disabled={disabled}
        />
      </div>

      <HopInput
        hops={ingredients.hop}
        onAdd={(data) => addIngredient("hop", data)}
        disabled={disabled}
      />

      <YeastInput
        yeasts={ingredients.yeast}
        onAdd={(data) => addIngredient("yeast", data)}
        disabled={disabled}
      />

      <OtherInput
        others={ingredients.other || ingredients.adjunct || []}
        onAdd={(data) => addIngredient("other", data)}
        disabled={disabled}
      />
    </div>
  );
}

export default IngredientInputsContainer;
