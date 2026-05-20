# Contributing to Tessera

Thank you for your interest in contributing to Tessera! This document provides guidelines and information for contributors.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/tessera.git`
3. Create a feature branch: `git checkout -b feature/my-feature`
4. Install dependencies: `npm install`
5. Run in dev mode: `npm start`

## Development Workflow

### Running locally

```bash
npm start
```

This launches Tessera in development mode with hot-reload for the renderer process.

### Code structure

- **`src/main/`** — Main process (Node.js). Handles window lifecycle, IPC, settings, global shortcuts.
- **`src/renderer/`** — Renderer process (browser). The split-pane UI, webview management.
- **`src/settings/`** — Settings window (separate renderer). Configuration UI.

### Making changes

1. Make your changes in the appropriate directory
2. Test locally with `npm start`
3. Run syntax checks: `node --check src/main/main.js`
4. Build to verify packaging works: `npm run dist:mac` (or your platform)

## Pull Request Process

1. Update the README.md if your change adds new features or settings
2. Ensure your code follows the existing style (no linter yet, but keep it consistent)
3. Write a clear PR description explaining what and why
4. One feature per PR — keep them focused

## Reporting Issues

When reporting bugs, please include:

- Your OS and version
- Tessera version
- Steps to reproduce
- Expected vs actual behavior
- Console output if relevant (View → Toggle Developer Tools)

## Feature Requests

Feature requests are welcome! Please open an issue with:

- A clear description of the feature
- The problem it solves
- Any implementation ideas you have

## Code Style

- Use `const` and `let`, never `var`
- Use async/await over raw promises where possible
- Keep functions small and focused
- Comment complex logic, but let clear code speak for itself
- Use meaningful variable names

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
