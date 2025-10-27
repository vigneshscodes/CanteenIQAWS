// backend/seedItems.js
import { ddb } from "./db/db.js"; // DynamoDB client
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

const items = [
  { name: "Idly", price: 30, imgurl: "/images/idly.jpg", availableQty: 50 },
  { name: "Dosa", price: 40, imgurl: "/images/dosa.jpg", availableQty: 50 },
  { name: "Poori", price: 45, imgurl: "/images/poori.jpeg", availableQty: 50 },
  { name: "Chapathi", price: 50, imgurl: "/images/chapathi.jpg", availableQty: 50 },
  { name: "Pongal", price: 35, imgurl: "/images/pongal.jpg", availableQty: 50 },
  { name: "Parotta", price: 50, imgurl: "/images/parotta.jpg", availableQty: 50 },
  { name: "Veg Rice", price: 60, imgurl: "/images/vegrice.png", availableQty: 50 },
  { name: "Meals", price: 80, imgurl: "/images/meals.jpg", availableQty: 50 },
  { name: "Sambar Rice", price: 50, imgurl: "/images/sambharrice.jpg", availableQty: 50 },
  { name: "Curd Rice", price: 40, imgurl: "/images/curdrice.jpg", availableQty: 50 },
];

async function seed() {
  for (const item of items) {
    const params = {
      TableName: "items",
      Item: {
        id: uuidv4(), // unique ID
        ...item,
        createdat: new Date().toISOString(),
        updatedat: new Date().toISOString(),
      },
    };

    try {
      await ddb.send(new PutCommand(params));
      console.log(`Inserted: ${item.name}`);
    } catch (err) {
      console.error("Error inserting", item.name, err);
    }
  }
  console.log("Seeding complete!");
}
seed();
