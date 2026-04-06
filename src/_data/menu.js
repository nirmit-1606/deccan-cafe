require("dotenv").config();
const { Client } = require("@notionhq/client");

const notion = new Client({
  auth: process.env.NOTION_API_KEY,
});

module.exports = async function() {
  const databaseId = process.env.MENU_DATABASE_ID;

    // Notion's API returns paginated results. Query repeatedly until we have all pages.
    const allResults = [];
    let start_cursor = undefined;

    do {
      const response = await notion.databases.query({
        database_id: databaseId,
        start_cursor,
      });

      if (response && Array.isArray(response.results)) {
        allResults.push(...response.results);
      }

      // prepare next loop
      start_cursor = response.has_more ? response.next_cursor : undefined;
    } while (start_cursor);

    // Debug: show how many items were fetched during the build
    try {
      console.log(`[eleventy] fetched ${allResults.length} menu items from Notion`);
    } catch (e) {
      // noop in environments that don't like console during build
    }

    return allResults.map(item => {
      return {
        id: item.id,
        name: item.properties.Name.title[0]?.plain_text,
        price: item.properties.Price.number,
        category: item.properties.Category.select?.name,
        categoryOrder: item.properties.Order.number || 999,
        description: item.properties.Description.rich_text[0]?.plain_text || "",
      };
    });
};
