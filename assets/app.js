const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const api = (url, options = {}) =>
  fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok)
      throw new Error(data.error || "Não foi possível concluir.");
    return data;
  });
const token = () => localStorage.getItem("hairstyles-token");
const feedback = (element, message, type = "error") => {
  element.textContent = message;
  element.dataset.type = type;
};
const lockSubmit = (form, locked) => {
  const button = $('button[type="submit"]', form);
  if (button) {
    button.disabled = locked;
    button.classList.toggle("is-loading", locked);
    button.textContent = locked
      ? "Aguarde..."
      : button.dataset.label || button.textContent;
  }
};

function updateAuthLinks() {
  const link = $("[data-auth-link]");
  if (link && token()) {
    link.textContent = "Meu perfil";
    link.href = "/perfil.html";
  }
  const profile = $("[data-profile-link]");
  if (profile && !token()) profile.href = "/login.html";
}
function money(cents) {
  return cents == null
    ? ""
    : new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(cents / 100);
}
function applyMasks() {
  $$("[data-mask]").forEach((input) =>
    input.addEventListener("input", () => {
      const digits = input.value.replace(/\D/g, "");
      if (input.dataset.mask === "cpf")
        input.value = digits
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d)/, "$1.$2")
          .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
      if (input.dataset.mask === "phone")
        input.value = digits
          .replace(/(\d{2})(\d)/, "($1) $2")
          .replace(/(\d{5})(\d)/, "$1-$2")
          .slice(0, 15);
      if (input.dataset.mask === "cep")
        input.value = digits.replace(/(\d{5})(\d)/, "$1-$2").slice(0, 9);
    }),
  );
  const cep = $('[name="cep"]');
  if (cep)
    cep.addEventListener("blur", async () => {
      if (cep.value.replace(/\D/g, "").length !== 8) return;
      try {
        const address = await fetch(
          `https://viacep.com.br/ws/${cep.value.replace(/\D/g, "")}/json/`,
        ).then((r) => r.json());
        if (address.erro) return;
        $('[name="street"]').value = address.logradouro || "";
        $('[name="neighborhood"]').value = address.bairro || "";
        $('[name="city"]').value = address.localidade || "";
        $('[name="state"]').value = address.uf || "";
      } catch {}
    });
}

async function loadPopular() {
  const target = $("#popular-services");
  if (!target) return;
  try {
    const { services } = await api("/api/services/popular");
    target.innerHTML = services
      .map(
        (service, index) =>
          `<article class="feed-card"><div class="image-placeholder">Imagem inserida posteriormente</div><div class="feed-meta"><span>0${index + 1}</span><h3>${service.name}</h3><p>${service.description}</p><strong>${service.price_note}</strong></div></article>`,
      )
      .join("");
  } catch (error) {
    target.innerHTML = `<p class="error-box">${error.message}</p>`;
  }
}

async function setupBooking() {
  const app = $("#booking-app");
  if (!app) return;
  if (!token()) {
    app.innerHTML =
      '<div class="notice">Entre na sua conta para escolher um horário. <a href="/login.html">Entrar agora</a></div>';
    return;
  }
  let services;
  try {
    services = (await api("/api/services")).services;
  } catch (error) {
    app.innerHTML = `<div class="error-box">${error.message}</div>`;
    return;
  }
  let selectedService = null;
  let selectedSlot = null;
  app.innerHTML = `<div class="service-grid">${services.map((service) => `<button class="service-option" data-id="${service.id}"><span class="square-placeholder">01</span><span><b>${service.name}</b><small>${service.description}</small><strong>${service.price_note}</strong></span></button>`).join("")}</div><div class="schedule-panel hidden"><label>Escolha uma data<input id="date-picker" type="date" min="${new Date().toISOString().slice(0, 10)}"></label><div id="slots" class="slots"></div><div class="disclaimers"><p>Todos os serviços de química deverão passar por diagnóstico capilar (teste de mechas), assim como outros tratamentos de acordo com a necessidade do cabelo.</p><p>Valores sujeitos a alterações de acordo com a necessidade do serviço.</p></div><button id="confirm-booking" class="button" disabled>Confirmar agendamento</button><p class="form-feedback" id="booking-feedback"></p></div>`;
  $$(".service-option", app).forEach((button) =>
    button.addEventListener("click", () => {
      $$(".service-option", app).forEach((item) =>
        item.classList.remove("selected"),
      );
      button.classList.add("selected");
      selectedService = Number(button.dataset.id);
      $(".schedule-panel", app).classList.remove("hidden");
      $(".steps span:nth-child(1)").classList.remove("current");
      $(".steps span:nth-child(2)").classList.add("current");
    }),
  );
  $("#date-picker").addEventListener("change", async (event) => {
    selectedSlot = null;
    $("#confirm-booking").disabled = true;
    $("#slots").innerHTML = '<span class="loading">Buscando horários...</span>';
    try {
      const { slots } = await api(
        `/api/availability?date=${event.target.value}`,
      );
      $("#slots").innerHTML = slots.length
        ? slots
            .map(
              (slot) =>
                `<button class="slot" data-id="${slot.id}">${slot.time}</button>`,
            )
            .join("")
        : '<span class="muted">Nenhum horário disponível nesta data.</span>';
      $$(".slot").forEach((slot) =>
        slot.addEventListener("click", () => {
          $$(".slot").forEach((item) => item.classList.remove("selected"));
          slot.classList.add("selected");
          selectedSlot = Number(slot.dataset.id);
          $("#confirm-booking").disabled = false;
        }),
      );
    } catch (error) {
      $("#slots").innerHTML = `<span class="error-box">${error.message}</span>`;
    }
  });
  $("#confirm-booking").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = "Confirmando...";
    try {
      await api("/api/bookings", {
        method: "POST",
        body: JSON.stringify({
          serviceId: selectedService,
          slotId: selectedSlot,
        }),
      });
      feedback(
        $("#booking-feedback"),
        "Agendamento confirmado. Até breve!",
        "success",
      );
      button.textContent = "Agendamento confirmado";
    } catch (error) {
      feedback($("#booking-feedback"), error.message);
      button.disabled = false;
      button.textContent = "Confirmar agendamento";
    }
  });
}

function setupForms() {
  const login = $("#login-form");
  if (login)
    login.addEventListener("submit", async (event) => {
      event.preventDefault();
      lockSubmit(login, true);
      const status = $(".form-feedback", login);
      try {
        const data = await api("/api/auth/login", {
          method: "POST",
          body: JSON.stringify(Object.fromEntries(new FormData(login))),
        });
        localStorage.setItem("hairstyles-token", data.token);
        location.href = "/perfil.html";
      } catch (error) {
        feedback(status, error.message);
        lockSubmit(login, false);
      }
    });
  const register = $("#register-form");
  if (register)
    register.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = Object.fromEntries(new FormData(register));
      const status = $(".form-feedback", register);
      if (formData.password !== formData.confirmPassword)
        return feedback(status, "As senhas precisam ser iguais.");
      lockSubmit(register, true);
      try {
        await api("/api/auth/register", {
          method: "POST",
          body: JSON.stringify({
            ...formData,
            address: {
              cep: formData.cep,
              street: formData.street,
              number: formData.number,
              complement: formData.complement,
              neighborhood: formData.neighborhood,
              city: formData.city,
              state: formData.state,
            },
          }),
        });
        feedback(status, "Cadastro criado. Você já pode entrar.", "success");
        lockSubmit(register, false);
        setTimeout(() => {
          location.href = "/login.html";
        }, 900);
      } catch (error) {
        feedback(status, error.message);
        lockSubmit(register, false);
      }
    });
  const recover = $("#recover-link");
  if (recover)
    recover.addEventListener("click", async (event) => {
      event.preventDefault();
      const email = prompt("Digite seu e-mail:");
      if (!email) return;
      try {
        const data = await api("/api/auth/recover", {
          method: "POST",
          body: JSON.stringify({ email }),
        });
        alert(data.message);
      } catch (error) {
        alert(error.message);
      }
    });
}
async function setupProfile() {
  if (!$("#profile-name")) return;
  if (!token()) return (location.href = "/login.html");
  try {
    const { user } = await api("/api/me", {
      headers: { Authorization: `Bearer ${token()}` },
    });
    $("#profile-name").textContent = user.name;
    $("#profile-email").textContent = user.email;
  } catch {
    localStorage.removeItem("hairstyles-token");
    location.href = "/login.html";
  }
  $("#logout").addEventListener("click", () => {
    localStorage.removeItem("hairstyles-token");
    location.href = "/index.html";
  });
}
updateAuthLinks();
applyMasks();
loadPopular();
setupForms();
setupBooking();
setupProfile();
