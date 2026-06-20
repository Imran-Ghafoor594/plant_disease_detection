# 🌿 PlantScan AI — Plant Disease Detection

A deep-learning powered web application that identifies plant diseases from a leaf photo and recommends treatment, using transfer learning on three CNN backbones — **EfficientNetB0**, **MobileNetV2**, and **ResNet50**.

The model inference is served through a **Flask** backend, with a custom HTML/CSS/JS frontend ("deep forest" themed UI) for uploading a photo and viewing the diagnosis report.

---

## 📁 Project Structure

```
plant-disease-detection/
├── notebooks/
│   ├── efficientnetb0.ipynb     # Trained on PlantVillage-color (38 classes)
│   ├── mobilenetv2.ipynb        # Trained on PlantVillage-color (38 classes)
│   └── resnet50.ipynb           # Trained on PlantVillage (15 classes)
│
├── app/
│   ├── app.py                            # Flask backend + inference logic
│   ├── templates/
│   │   └── index.html
│   ├── static/
│   │   ├── css/
│   │   │   └── style.css
│   │   └── js/
│   │       └── app.js
│   └── treatments.json                   # Disease info: description, symptoms, treatment, prevention
│   
├── classes/
    └── class_names.json                  # 38 class labels, in training order
├── models/                               # trained model.keras
├── README.md
├── reprots/
      └── REPORT.md                       # Full training report + model comparison 
├── config.py                          
├── requirements.txt
└── .gitignore
```
---

## 🧠 What's in this project

### 1. Three training notebooks (transfer learning, 2-phase: frozen → fine-tune)

| Notebook | Backbone | Dataset | Classes |
|---|---|---|---|
| `efficientnetb0.ipynb` | EfficientNetB0 (ImageNet) | PlantVillage — **color** (Kaggle: `abdallahalidev/plantvillage-dataset`) | 38 |
| `mobilenetv2.ipynb` | MobileNetV2 (ImageNet) | PlantVillage — **color** (Kaggle: `abdallahalidev/plantvillage-dataset`) | 38 |
| `resnet50.ipynb` | ResNet50 (ImageNet) | PlantVillage (Kaggle: `emmarex/plantdisease`) — Pepper/Potato/Tomato only | 15 |

⚠️ **Important:** ResNet50 was trained on a *different, smaller* dataset (15 classes, only 3 crop types) than EfficientNetB0/MobileNetV2 (38 classes, 14 crop types). Its results are **not directly comparable** to the other two — see `REPORT.md` for the full breakdown.

All three notebooks follow the same recipe:
1. Load images via `image_dataset_from_directory` (224×224, 80/20 train/val split, `seed=42`)
2. In-graph data augmentation (flip, rotation, zoom, contrast, translation)
3. Load ImageNet-pretrained backbone, freeze it, add `GlobalAveragePooling2D → Dropout → Dense(softmax)` head
4. **Phase 1:** train the new head only (backbone frozen)
5. **Phase 2:** unfreeze the last 30 layers of the backbone and fine-tune at a low learning rate (`1e-5`)
6. Evaluate with `classification_report` + confusion matrix

### 2. Flask Web App (`app/`)
- `POST /predict` accepts an uploaded image **and a `model` field**, runs it through the chosen `.keras` model, looks up the predicted class in `treatments.json`, and returns JSON (label, confidence, which model was used, treatment info, base64 thumbnail).
- Frontend (`index.html` + `app.js` + `style.css`) is a drag-and-drop upload UI with a **model-selection dropdown**, an animated "scanning" state, and a diagnosis report (symptoms / treatment / prevention / confidence bar / which model produced the result).
- **Model dropdown only offers EfficientNetB0 and MobileNetV2** — both trained on the same 38-class dataset, so they share `class_names.json` and are safely interchangeable. **ResNet50 is intentionally excluded**: it was trained on a different 15-class dataset (Pepper/Potato/Tomato only), so its output indices don't correspond to the same `class_names.json` — wiring it into the same dropdown would require a second class list and separate UI handling, and isn't a clean drop-in swap.
- Default selection is **EfficientNetB0** — per `REPORT.md`, it's the more accurate of the two (98% vs 95%).

---

## ⚙️ Setup & Installation

```bash
git clone https://github.com/Imran-Ghafoor594/plant_disease_detection.git
cd plant-disease-detection

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

pip install -r requirements.txt
```

### Running the app locally
1. Put your two trained model files in `app/models/` and name them to match `app.py`:
   - `app/models/efficientnetb0.keras`
   - `app/models/mobilenetv2.keras`

   (Or edit the paths in the `MODELS` dict near the top of `app.py` to match whatever filenames you used.)
2. Add `app/class_names.json` (already provided — 38 labels, shared by both models) and `app/treatments.json` (see schema below — **not included in the upload, needs to be created**).
3. Run:
```bash
cd app
python app.py
```
App will be available at `http://127.0.0.1:5000`.

### Re-running the training notebooks
- Designed for **Kaggle/Colab with a GPU** (T4 used in the original runs).
- Dataset paths (`/kaggle/input/...`, `/content/dataset/...`) will need to be adjusted to wherever you mount/download the datasets.
- ResNet50 notebook downloads its dataset via the Kaggle CLI (`kaggle datasets download -d emmarex/plantdisease`) — needs a `kaggle.json` API token (never commit this file — it's in `.gitignore`).

---

## 🩹 `treatments.json` schema

This file is **referenced by `app.py` but wasn't included in the upload** — it needs to be created with one entry per class label (matching `class_names.json` exactly), e.g.:

```json
{
  "Tomato___Early_blight": {
    "disease_name": "Tomato Early Blight",
    "description": "A fungal disease caused by Alternaria solani affecting tomato leaves.",
    "severity": "Medium",
    "symptoms": ["Dark concentric spots on lower leaves", "Yellowing around lesions"],
    "treatment": ["Apply a copper-based or chlorothalonil fungicide", "Remove and destroy infected leaves"],
    "prevention": ["Rotate crops yearly", "Avoid overhead watering", "Mulch around the base of plants"]
  }
}
```
For `*___healthy` classes, use a "no disease detected" style entry (`severity: "None"`, empty `treatment`/`symptoms`).

---

---

## Model Selection Dropdown

`app.py`, `index.html`, `app.js`, and `style.css` have been updated so the user can **pick which model runs the prediction** from a dropdown in the upload panel, instead of the app being hardcoded to one model:

- **EfficientNetB0** — 98% accuracy (default selection)
- **MobileNetV2** — 95% accuracy, smaller/faster

**ResNet50 is not in the dropdown** — it was trained on a different 15-class dataset (only Pepper/Potato/Tomato), so its predictions don't map onto the same `class_names.json` as the other two. Mixing it into the same selector would silently produce wrong/meaningless labels for the other 23 classes whenever ResNet50 is selected, so it's left out rather than wired in incorrectly.

How it works end-to-end:
1. `app.py` loads **both** `.keras` models at startup into a `MODELS` dict (`efficientnetb0.keras`, `mobilenetv2.keras`), keyed by `"efficientnet"` / `"mobilenet"`.
2. `index.html`'s `<select id="modelSelect">` is built server-side from that same dict (via Jinja), so the dropdown always reflects whatever models are actually loaded.
3. `app.js` reads the selected `<option>` value and appends it to the `FormData` sent to `POST /predict` as a `model` field; it also updates the header badge, loading-step text, and disables the dropdown while a request is in flight.
4. `/predict` reads `request.form.get('model')`, picks the matching model from `MODELS`, runs inference, and returns which model produced the result (`model_used`) — shown in the results panel as "Diagnosed using EfficientNetB0".

---

## 📊 Results at a glance

| Model | Dataset | Classes | Params | Final Accuracy |
|---|---|---|---|---|
| **EfficientNetB0** | PlantVillage-color | 38 | 4.1M | **98%** ✅ |
| MobileNetV2 | PlantVillage-color | 38 | 2.3M | 95% |
| ResNet50 | PlantVillage (subset) | 15 | 23.6M | 96% |

Full breakdown, per-class metrics, and the **MobileNetV2 vs EfficientNetB0 comparison** are in **[`REPORT.md`](./REPORT.md)**.

---

## Tech Stack
- **Training:** TensorFlow / Keras, scikit-learn, OpenCV, seaborn, matplotlib
- **Backend:** Flask
- **Frontend:** HTML, CSS, vanilla JavaScript
