import RecipeCard from "./RecipeCard"
const RecipeCardContainer = ({recipes}) => { 
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {recipes.map((recipe) => (
                <RecipeCard key={recipe.recipe_id} recipe={recipe} />
            ))}
        </div>
    );
 }

 export default RecipeCardContainer;