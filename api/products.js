export default async function handler(req, res) {
  try {
    const BASE_ID = "appR99ityFDyaQBNM";
    const TABLE = "Products";
    const VIEW = "Store";
    const TOKEN = process.env.AIRTABLE_TOKEN;

    const airtableUrl = `https://api.airtable.com/v0/${BASE_ID}/${encodeURIComponent(TABLE)}?view=${encodeURIComponent(VIEW)}`;

    const airtableRes = await fetch(airtableUrl, {
      headers: {
        Authorization: `Bearer ${TOKEN}`,
      },
    });

    const data = await airtableRes.json();

    if (!airtableRes.ok) {
      return res.status(airtableRes.status).json({
        error: "Failed to load Airtable data",
        details: data,
      });
    }

    const products = (data.records || []).map((record) => {
      const fields = record.fields || {};
      return {
        id: record.id,
        name: fields.Name || "Untitled",
        price: fields["Price AED"] || 0,
        photo: fields.Photo?.[0]?.url || "",
        description: fields.Description || "",
        category: fields.Category || "Other",
        sort: fields.Sort || 999,
        stockStatus: fields["Stock Status"] || "",
        slug: fields.Slug || "",
      };
    });

    return res.status(200).json({ products });
  } catch (error) {
    return res.status(500).json({
      error: "Server error",
      message: error.message,
    });
  }
}
