import RecipeCard from "./RecipeCard"

const RecipeCardContainer = ({recipes}) => { 
    return (
        <div className="recipe-card-container">
            {recipes.map((recipe) => (
                <RecipeCard key={recipe.recipe_id} recipe={recipe} />
            ))}
        </div>
    );
 }

 export default RecipeCardContainer;