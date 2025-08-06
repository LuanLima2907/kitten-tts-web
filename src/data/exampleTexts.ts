/**
 * Example texts for testing KittenTTS
 */

export const EXAMPLE_TEXTS = [
  {
    title: "Simple Greeting",
    text: "Hello, this is KittenTTS running in your web browser! How does this sound to you?"
  },
  {
    title: "Technical Demo",
    text: "This text-to-speech model is running entirely in the browser using ONNX Runtime Web. The model weights are only 25 megabytes, making it perfect for client-side inference."
  },
  {
    title: "Story Fragment",
    text: "Once upon a time, in a digital realm where artificial intelligence and web browsers converged, there lived a tiny neural network called KittenTTS. Despite its small size, it had the remarkable ability to transform written words into spoken language."
  },
  {
    title: "News Style",
    text: "Breaking news: Advanced text-to-speech technology is now available directly in web browsers. The lightweight model delivers high-quality voice synthesis without requiring server-side processing or internet connectivity."
  },
  {
    title: "Conversational",
    text: "You know what's really cool about this? The entire speech synthesis is happening right in your browser. No data is sent to any server, which means your privacy is completely protected."
  },
  {
    title: "Technical Explanation",
    text: "ONNX Runtime Web enables machine learning inference in JavaScript environments. By leveraging WebAssembly and WebGL, it can efficiently execute neural networks directly in the browser."
  }
] as const;