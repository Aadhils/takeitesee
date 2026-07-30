
const brandIntro = document.getElementById("brandIntro");
const mainWebsite = document.getElementById("mainWebsite");
const skipBrandIntro = document.getElementById("skipBrandIntro");
const introScenes = Array.from(document.querySelectorAll(".intro-scene"));
const introProgressBar = document.getElementById("introProgressBar");

let introComplete = false;
const introTimers = [];
const sceneTimes = [0, 1150, 3000, 4250, 5550, 6850];

function showIntroScene(index) {
  introScenes.forEach((scene, sceneIndex) => {
    scene.classList.toggle("active", sceneIndex === index);
  });
}

function completeBrandIntro() {
  if (introComplete) return;
  introComplete = true;

  introTimers.forEach(window.clearTimeout);
  brandIntro.classList.add("intro-hidden");
  mainWebsite.classList.add("website-visible");
  mainWebsite.setAttribute("aria-hidden", "false");
  document.body.classList.remove("intro-active");

  window.setTimeout(() => {
    brandIntro.remove();
  }, 950);
}

function startBrandStory() {
  if (!brandIntro) return;

  introProgressBar.classList.add("running");

  sceneTimes.forEach((time, index) => {
    introTimers.push(
      window.setTimeout(() => showIntroScene(index), time)
    );
  });

  introTimers.push(window.setTimeout(completeBrandIntro, 8150));
}

skipBrandIntro.addEventListener("click", completeBrandIntro);
window.addEventListener("load", startBrandStory);


const revealItems = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

revealItems.forEach((item) => observer.observe(item));

// Ensure first-screen content appears immediately.
window.addEventListener("load", () => {
  document.querySelectorAll(".hero .reveal").forEach((item) => {
    item.classList.add("visible");
  });
});
