const texts = ["Transform. Compress. Convert.", "Published by Manan Kohli."];
let index = 0;
let charIndex = 0;
let isDeleting = false;
const speed = 100; // Typing speed in ms
const delay = 2000; // Delay before switching text
const blankDelay = 500; // Delay to show blank space when deleting

function typeEffect() {
  let currentText = texts[index];
  let displayText = currentText.substring(0, charIndex);
  document.getElementById("typewriter").textContent = displayText;

  if (isDeleting) {
    if (charIndex > 0) {
      charIndex--;
      setTimeout(typeEffect, speed / 2); // Faster deletion
    } else {
      document.getElementById("typewriter").textContent = ""; // Show blank space
      setTimeout(() => {
        isDeleting = false;
        index = (index + 1) % texts.length;
        setTimeout(typeEffect, speed);
      }, blankDelay);
    }
  } else {
    if (charIndex <= currentText.length) {
      charIndex++;
      setTimeout(typeEffect, speed);
    } else {
      isDeleting = true;
      setTimeout(typeEffect, delay);
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  typeEffect();

  // Smooth scroll effect for the button
  const scrollButton = document.querySelector("a[href='#hr']");
  if (scrollButton) {
    scrollButton.addEventListener("click", function (event) {
      event.preventDefault(); // Prevent default anchor behavior

      const targetElement = document.querySelector("#hr");
      if (targetElement) {
        targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }
});
