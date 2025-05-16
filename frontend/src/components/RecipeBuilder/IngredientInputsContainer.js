// components/RecipeBuilder/IngredientInputsContainer.js
import React from "react";
import GrainInput from "./GrainInput";
import HopInput from "./HopInput";
import YeastInput from "./YeastInput";
import AdjunctInput from "./AdjunctInput";

function IngredientInputsContainer({
  ingredients,
  addIngredient,
  calculateMetrics,
}) {
  return (
    <>
      <div className="grid-col-2-3">
        <GrainInput
          grains={ingredients.grain}
          onAdd={(data) => addIngredient("grain", data)}
          onCalculate={calculateMetrics}
        />
      </div>

      <HopInput
        hops={ingredients.hop}
        onAdd={(data) => addIngredient("hop", data)}
        onCalculate={calculateMetrics}
      />

      <YeastInput
        yeasts={ingredients.yeast}
        onAdd={(data) => addIngredient("yeast", data)}
        onCalculate={calculateMetrics}
      />

      <AdjunctInput
        adjuncts={ingredients.adjunct}
        onAdd={(data) => addIngredient("adjunct", data)}
        onCalculate={calculateMetrics}
      />
    </>
  );
}

export default IngredientInputsContainer;
