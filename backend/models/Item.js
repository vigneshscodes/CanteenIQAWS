import mongoose from "mongoose";

const ItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  imgurl: { type: String },
  availableQty: { type: Number, default: 0 },
  createdat: { type: Date, default: Date.now },
  updatedat: { type: Date, default: Date.now },
});

const Item = mongoose.model("Item", ItemSchema);

export default Item; // ✅ default export
