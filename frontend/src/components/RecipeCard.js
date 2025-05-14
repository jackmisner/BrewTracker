const RecipeCard = ({ recipe }) => {
  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h2 className="text-xl font-semibold">{recipe.name}</h2>
      <p className="text-gray-600">{recipe.style}</p>
        <p className="text-sm text-gray-500">
            {recipe.description || "No description available."}</p>
      <p className="text-sm text-gray-500">
        Created on: {new Date(recipe.created_at).toLocaleDateString()}
      </p>
    </div>
  );
}
export default RecipeCard;