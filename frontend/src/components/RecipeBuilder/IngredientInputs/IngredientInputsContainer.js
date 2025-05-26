import GrainInput from "./GrainInput";
import HopInput from "./HopInput";
import YeastInput from "./YeastInput";
import AdjunctInput from "./AdjunctInput";

function IngredientInputsContainer({
  ingredients,
  addIngredient,
  disabled = false,
}) {
  return (
    <div className="ingredient-inputs-container">
      <div className="grid-col-2-3">
        <GrainInput
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

      <AdjunctInput
        adjuncts={ingredients.adjunct}
        onAdd={(data) => addIngredient("adjunct", data)}
        disabled={disabled}
      />
    </div>
  );
}

export default IngredientInputsContainer;
