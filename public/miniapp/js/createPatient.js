import { openConfirmAppointment } from "./confirmAppointment.js";
import { getSelectedSlotObject } from "./createVisit.js";

export function openCreatePatient() {

  const overlay = document.createElement("div");
  overlay.className = "patient-overlay";

  overlay.innerHTML = `
    <div class="patient-container">

      <div class="patient-header">
        <div class="patient-title">Новый пациент</div>
        <div class="patient-close" id="closeCreatePatient">✕</div>
      </div>

      <div class="patient-search-block">

     
       <input 
  type="text" 
  id="newLastName" 
  class="form-input compact" 
  placeholder="Фамилия *" 
/>
       <input 
  type="text" 
  id="newFirstName" 
  class="form-input compact" 
  placeholder="Имя *" 
/>
     <input 
  type="text" 
  id="newThirdName" 
  class="form-input compact" 
  placeholder="Отчество" 
/>

<div class="row-two">

  <div class="field-group">
    <label class="field-label center">Пол</label>
<select id="newGender" class="form-input compact" required>
  <option value="" selected disabled hidden></option>
  <option value="male">Мужской</option>
  <option value="female">Женский</option>
</select>

  </div>

  <div class="field-group">
    <label class="field-label center">Дата рождения</label>
    <input
      type="date"
      id="newBirthDate"
      class="form-input compact"
    />
  </div>

</div>



<input 
  type="tel" 
  id="newPhone" 
  class="form-input compact" 
  placeholder="+7 (___) ___ __-__ *"
/>

<input 
  type="email" 
  id="newEmail" 
  class="form-input compact" 
  placeholder="E-mail"
/>

      </div>

      <div class="patient-bottom">
       <button class="primary-btn" id="createPatientNext">
  Далее
</button>
      </div>

    </div>
  `;

  document.body.appendChild(overlay);

  const lastName = document.getElementById("newLastName");
  const firstName = document.getElementById("newFirstName");
  const thirdName = document.getElementById("newThirdName");
  const phone = document.getElementById("newPhone");
  const email = document.getElementById("newEmail");
  const nextBtn = document.getElementById("createPatientNext");
  const gender = document.getElementById("newGender");

;


  document
    .getElementById("closeCreatePatient")
    .addEventListener("click", () => overlay.remove());

  // ===============================
  // ВАЛИДАЦИЯ ФИО (только русские)
  // ===============================

  const fioRegex = /^[А-ЯЁ][а-яё]+(?:[- ][А-ЯЁ][а-яё]+)*$/;

 function validateFio(input) {
  const value = input.value.trim();
  if (!value) return false; // теперь пустое поле не считается валидным
  return fioRegex.test(value);
}


  // ===============================
  // ВАЛИДАЦИЯ EMAIL
  // ===============================

  function validateEmail(value) {
    if (!value) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  }

  // ===============================
  // МАСКА ТЕЛЕФОНА
  // ===============================
phone.addEventListener("input", (e) => {

  let digits = e.target.value.replace(/\D/g, "");

  // если пользователь начал с 8 → заменяем на 7
  if (digits.startsWith("8")) {
    digits = "7" + digits.slice(1);
  }

  // если пользователь не ввёл 7 в начале → добавляем её
  if (!digits.startsWith("7")) {
    digits = "7" + digits;
  }

  // максимум 11 цифр
  digits = digits.substring(0, 11);

  let formatted = "+7";

  if (digits.length > 1) {
    formatted += " (" + digits.substring(1, 4);
  }

  if (digits.length >= 4) {
    formatted += ") " + digits.substring(4, 7);
  }

  if (digits.length >= 7) {
    formatted += " " + digits.substring(7, 9);
  }

  if (digits.length >= 9) {
    formatted += "-" + digits.substring(9, 11);
  }

  e.target.value = formatted;

  validateForm();
});


  // ===============================
  // ПРОВЕРКА ВОЗРАСТА
  // ===============================

function capitalizeFio(value) {
  if (!value) return "";

  return value
    .toLowerCase()
    .replace(/(^|\s|-)[а-яё]/g, char => char.toUpperCase());
}




  function isUnder18(dateString) {

    if (!dateString) return false;

    const birth = new Date(dateString);
    const today = new Date();

    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();

    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }

    return age < 18;
  }

  // ===============================
  // ОБЩАЯ ВАЛИДАЦИЯ
  // ===============================

  function toggleError(input, hasError) {
    input.classList.toggle("input-error", hasError);
  }

function validateForm(showErrors = false) {

  const isLastValid =
    validateFio(lastName);

  const isFirstValid =
    validateFio(firstName);

  const isThirdValid =
    thirdName.value.trim() === "" ||
    validateFio(thirdName);

  const isPhoneValid =
    phone.value.replace(/\D/g, "").length === 11;

  const emailValue = email.value.trim();
  const isEmailValid =
    emailValue === "" || validateEmail(emailValue);

  if (showErrors) {
    toggleError(lastName, !isLastValid);
    toggleError(firstName, !isFirstValid);
    toggleError(thirdName, !isThirdValid);
    toggleError(phone, !isPhoneValid);
    toggleError(email, emailValue !== "" && !isEmailValid);
  }

  return (
    isLastValid &&
    isFirstValid &&
    isThirdValid &&
    isPhoneValid &&
    isEmailValid
  );
}


lastName.addEventListener("input", (e) => {
  e.target.value = capitalizeFio(e.target.value);
  validateForm();
});

firstName.addEventListener("input", (e) => {
  e.target.value = capitalizeFio(e.target.value);
  validateForm();
});

thirdName.addEventListener("input", (e) => {
  e.target.value = capitalizeFio(e.target.value);
  validateForm();
});

  email.addEventListener("input", validateForm);

  // ===============================
  // FORMAT HELPERS
  // ===============================




if (gender) {
  gender.addEventListener("change", () => {
    if (gender.value) {
      gender.classList.add("valid");
    } else {
      gender.classList.remove("valid");
    }
  });
}


  


  // ===============================
  // КНОПКА ДАЛЕЕ
  // ===============================

nextBtn.addEventListener("click", async () => {

  const isValid = validateForm(true);
  if (!isValid) return;

  const birthValue = document.getElementById("newBirthDate").value;
  const genderValue = document.getElementById("newGender").value;

  const slot = getSelectedSlotObject();
  if (!slot) return;

  const phoneDigits = phone.value.replace(/\D/g, "");
  const formattedPhone = "+" + phoneDigits;

  try {

    const response = await fetch("/miniapp/get-patient", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_name: lastName.value.trim(),
        first_name: firstName.value.trim(),
        mobile: phoneDigits,
         initData: window.WebApp.initData
      })
    });

    const data = await response.json();

    if (data.error !== 0) {
      proceedCreate();
      return;
    }

    if (!data.data) {
      // пациента нет
      proceedCreate();
      return;
    }

    // Если найден пациент или массив пациентов
    showExistingPatients(data.data, overlay);

  } catch (err) {
    proceedCreate();
  }



  
  function proceedCreate() {

    const patient = {
      isNew: true,
      last_name: lastName.value.trim(),
      first_name: firstName.value.trim(),
      third_name: thirdName.value.trim(),
      gender: formatGender(genderValue),
      birth_date: formatBirthDate(birthValue),
      mobile: formattedPhone,
      email: email.value.trim()
    };

    overlay.remove();
    openConfirmAppointment(patient, slot);
  }
  
 
});



}

function formatGender(value) {
  if (!value) return "—";

  const v = String(value).toLowerCase();

  if (v === "male" || v === "m" || v === "1" || v === "м")
    return "М";

  if (v === "female" || v === "f" || v === "2" || v === "ж")
    return "Ж";

  return "—";
}

  function formatBirthDate(dateString) {
    if (!dateString) return "—";

    const d = new Date(dateString);

    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();

    return `${dd}-${mm}-${yyyy}`;
  }



function showExistingPatients(foundData, createOverlay) {

  let patients = Array.isArray(foundData)
    ? foundData
    : [foundData];

  const modal = document.createElement("div");
  modal.className = "patient-overlay";

  modal.innerHTML = `
    <div class="patient-container">

      <div class="patient-header">
        <div class="patient-title">Найден существующий пациент</div>
        <div class="patient-close" id="closeDuplicate">✕</div>
      </div>

      <div class="patient-results">
        ${patients.map(p => `
          <div class="patient-card duplicate-card" data-id="${p.patient_id}">
            <div class="patient-name">
              ${p.last_name} ${p.first_name} ${p.third_name || ""}
            </div>
            <div class="patient-birth">
              Телефон: ${p.mobile || "—"}
            </div>
            <div class="patient-birth">
              Дата рождения: ${p.birth_date || "—"}
            </div>
          </div>
        `).join("")}
      </div>

      <div class="patient-bottom">
        <button class="secondary-btn" id="createAnyway">
          Создать нового
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  document
    .getElementById("closeDuplicate")
    .addEventListener("click", () => modal.remove());

  // выбор существующего
modal.querySelectorAll(".duplicate-card")
  .forEach((card, index) => {

    card.addEventListener("click", () => {

      const selectedPatient = patients[index];
      const slot = getSelectedSlotObject();
      if (!slot) return;

modal.remove();

if (createOverlay) createOverlay.remove();

openConfirmAppointment({
        isNew: false,
        patient_id: selectedPatient.patient_id,
        last_name: selectedPatient.last_name,
        first_name: selectedPatient.first_name,
        third_name: selectedPatient.third_name || "",
        gender: formatGender(selectedPatient.gender),
        birth_date: selectedPatient.birth_date || "—",
        mobile: selectedPatient.mobile || "—",
        email: selectedPatient.email || ""
      }, slot);

    });

  });


document
  .getElementById("createAnyway")
  .addEventListener("click", () => {

    const slot = getSelectedSlotObject();
    if (!slot) return;

    const phoneDigits =
      document.getElementById("newPhone").value.replace(/\D/g, "");

    const birthValue =
      document.getElementById("newBirthDate").value;

    const genderValue =
      document.getElementById("newGender").value;

    const patient = {
      isNew: true,
      last_name: document.getElementById("newLastName").value.trim(),
      first_name: document.getElementById("newFirstName").value.trim(),
      third_name: document.getElementById("newThirdName").value.trim(),
      gender: formatGender(genderValue),
      birth_date: birthValue
        ? formatBirthDate(birthValue)
        : "—",
      mobile: "+" + phoneDigits,
      email: document.getElementById("newEmail").value.trim()
    };

    // закрываем сначала модалку дубликатов
 modal.remove();

if (createOverlay) createOverlay.remove();

openConfirmAppointment(patient, slot);
  });


}

