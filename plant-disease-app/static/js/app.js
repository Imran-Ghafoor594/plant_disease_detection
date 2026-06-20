/* ═══════════════════════════════════════
   PlantScan AI — Frontend Logic
═══════════════════════════════════════ */

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const scanBar = document.getElementById('scanBar');
const clearBtn = document.getElementById('clearBtn');
const analyzeBtn = document.getElementById('analyzeBtn');

const modelSelect = document.getElementById('modelSelect');
const modelHint = document.getElementById('modelHint');
const activeModelBadge = document.getElementById('activeModelBadge');
const loadingModelName = document.getElementById('loadingModelName');

const MODEL_HINTS = {
  efficientnet: 'Highest accuracy — recommended for most cases.',
  mobilenet: 'Smaller & faster — good for quick scans / low-power devices.'
};

function updateModelUI() {
  const opt = modelSelect.options[modelSelect.selectedIndex];
  const label = opt.text.split('—')[0].trim(); // e.g. "EfficientNetB0"
  activeModelBadge.textContent = label;
  loadingModelName.textContent = label;
  modelHint.textContent = MODEL_HINTS[modelSelect.value] || '';
}

modelSelect.addEventListener('change', updateModelUI);
updateModelUI(); // set initial state on page load

const emptyState = document.getElementById('emptyState');
const loadingState = document.getElementById('loadingState');
const resultContent = document.getElementById('resultContent');

const step1 = document.getElementById('step1');
const step2 = document.getElementById('step2');
const step3 = document.getElementById('step3');

let selectedFile = null;

// ── Upload / Drop ──────────────────────────────────────────
dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('image/')) loadFile(file);
});

fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) loadFile(e.target.files[0]);
});

function loadFile(file) {
  selectedFile = file;
  const reader = new FileReader();
  reader.onload = (e) => {
    previewImg.src = e.target.result;
    dropZone.style.display = 'none';
    imagePreview.style.display = 'block';
    analyzeBtn.disabled = false;
    // Trigger scan animation
    scanBar.classList.remove('active');
    void scanBar.offsetWidth;
    scanBar.classList.add('active');
  };
  reader.readAsDataURL(file);
}

clearBtn.addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  previewImg.src = '';
  imagePreview.style.display = 'none';
  dropZone.style.display = 'flex';
  analyzeBtn.disabled = true;
  showEmpty();
});

// ── Analyze ───────────────────────────────────────────────
analyzeBtn.addEventListener('click', runAnalysis);

async function runAnalysis() {
  if (!selectedFile) return;

  analyzeBtn.disabled = true;
  modelSelect.disabled = true;
  analyzeBtn.querySelector('.btn-text').textContent = 'Analyzing…';
  showLoading();

  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('model', modelSelect.value);

  try {
    // Step 1
    activateStep(step1, step2, step3, 0);
    await delay(500);

    // Step 2
    activateStep(step1, step2, step3, 1);
    const response = await fetch('/predict', { method: 'POST', body: formData });
    await delay(300);

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Server error');
    }

    // Step 3
    activateStep(step1, step2, step3, 2);
    await delay(300);

    const data = await response.json();
    await delay(300);

    showResults(data);

  } catch (err) {
    showEmpty();
    alert('Error: ' + err.message);
  } finally {
    analyzeBtn.disabled = false;
    modelSelect.disabled = false;
    analyzeBtn.querySelector('.btn-text').textContent = 'Analyze Plant';
  }
}

function activateStep(s1, s2, s3, idx) {
  const steps = [s1, s2, s3];
  steps.forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i < idx) s.classList.add('done');
    if (i === idx) s.classList.add('active');
  });
}

// ── Show / Hide States ────────────────────────────────────
function showEmpty() {
  emptyState.style.display = 'flex';
  loadingState.style.display = 'none';
  resultContent.style.display = 'none';
}

function showLoading() {
  emptyState.style.display = 'none';
  loadingState.style.display = 'flex';
  resultContent.style.display = 'none';
  // Reset steps
  [step1, step2, step3].forEach(s => s.classList.remove('active', 'done'));
}

function showResults(data) {
  loadingState.style.display = 'none';
  resultContent.style.display = 'flex';

  const t = data.treatment;

  // Thumbnail
  document.getElementById('resultThumb').src = `data:image/jpeg;base64,${data.image}`;

  // Disease name
  document.getElementById('diseaseName').textContent = t.disease_name || data.label;

  // Which model produced this result
  document.getElementById('resultModelName').textContent = data.model_used || '—';

  // Confidence bar
  const conf = data.confidence;
  document.getElementById('confidenceLabel').textContent = conf + '% Confidence';
  setTimeout(() => {
    document.getElementById('confidenceFill').style.width = conf + '%';
  }, 100);

  // Severity badge
  const badge = document.getElementById('severityBadge');
  const sev = (t.severity || 'Unknown').toLowerCase();
  badge.textContent = 'Severity: ' + (t.severity || 'Unknown');
  badge.className = 'severity-badge';
  if (sev === 'none') badge.classList.add('none');
  else if (sev === 'high') badge.classList.add('high');

  // Description
  document.getElementById('descriptionText').textContent = t.description || '—';

  // Symptoms
  const symptomsSec = document.getElementById('symptomsSection');
  const symptomsList = document.getElementById('symptomsList');
  if (t.symptoms && t.symptoms.length > 0) {
    symptomsList.innerHTML = t.symptoms.map(s => `<li>${s}</li>`).join('');
    symptomsSec.style.display = '';
  } else {
    symptomsSec.style.display = 'none';
  }

  // Treatment
  document.getElementById('treatmentList').innerHTML =
    (t.treatment || []).map(s => `<li>${s}</li>`).join('');

  // Prevention
  document.getElementById('preventionList').innerHTML =
    (t.prevention || []).map(s => `<li>${s}</li>`).join('');
}

// ── New Scan Button ───────────────────────────────────────
document.getElementById('newScanBtn').addEventListener('click', () => {
  selectedFile = null;
  fileInput.value = '';
  previewImg.src = '';
  imagePreview.style.display = 'none';
  dropZone.style.display = 'flex';
  analyzeBtn.disabled = true;
  showEmpty();
});

// ── Utility ───────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }