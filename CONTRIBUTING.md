# 🤝 Guide de Contribution

Merci de votre intérêt pour contribuer à **Distribution Calendriers Pompiers** ! 🚒

## 📋 Table des matières

- [Code de Conduite](#code-de-conduite)
- [Comment contribuer](#comment-contribuer)
- [Signaler un bug](#signaler-un-bug)
- [Proposer une fonctionnalité](#proposer-une-fonctionnalité)
- [Pull Requests](#pull-requests)
- [Standards de code](#standards-de-code)
- [Configuration du développement](#configuration-du-développement)

## Code de Conduite

En participant à ce projet, vous vous engagez à respecter notre communauté et à créer un environnement respectueux et inclusif pour tous.

## Comment contribuer

Il existe plusieurs façons de contribuer :

- 🐛 Signaler des bugs
- 💡 Proposer de nouvelles fonctionnalités
- 📝 Améliorer la documentation
- 🔧 Corriger des bugs
- ✨ Développer de nouvelles fonctionnalités
- 🎨 Améliorer le design

## Signaler un bug

### Avant de signaler

1. **Vérifiez** que le bug n'a pas déjà été signalé dans les [issues](https://github.com/votre-username/distribution_calendriers_pompiers/issues)
2. **Vérifiez** que vous utilisez la dernière version
3. **Testez** si le bug se reproduit

### Comment signaler un bug

Créez une [nouvelle issue](https://github.com/votre-username/distribution_calendriers_pompiers/issues/new) avec :

**Titre** : Description courte et claire du bug

**Description** :
- 📝 Description détaillée du problème
- 🔄 Étapes pour reproduire le bug
- ✅ Comportement attendu
- ❌ Comportement observé
- 🖼️ Screenshots si applicable
- 💻 Environnement (OS, navigateur, version Docker)
- 📋 Logs pertinents

**Template** :
```markdown
## Description
[Décrivez le bug]

## Étapes pour reproduire
1. Aller sur '...'
2. Cliquer sur '...'
3. Voir l'erreur

## Comportement attendu
[Ce qui devrait se passer]

## Comportement observé
[Ce qui se passe réellement]

## Screenshots
[Si applicable]

## Environnement
- OS: [ex: Ubuntu 22.04]
- Navigateur: [ex: Chrome 120]
- Version Docker: [ex: 24.0.6]

## Logs
\`\`\`
[Coller les logs pertinents]
\`\`\`
```

## Proposer une fonctionnalité

Avant de proposer une nouvelle fonctionnalité :

1. **Vérifiez** la [roadmap](README.md#-roadmap) et les [issues](https://github.com/votre-username/distribution_calendriers_pompiers/issues)
2. **Discutez** de l'idée dans une [discussion](https://github.com/votre-username/distribution_calendriers_pompiers/discussions)

### Template de proposition

```markdown
## Fonctionnalité proposée
[Description courte]

## Problème résolu
[Quel problème cette fonctionnalité résout-elle ?]

## Solution proposée
[Comment cette fonctionnalité fonctionnerait]

## Alternatives considérées
[Autres solutions envisagées]

## Impact
- [ ] Impacte l'interface utilisateur
- [ ] Impacte la base de données
- [ ] Impacte les performances
- [ ] Breaking change

## Screenshots/Mockups
[Si applicable]
```

## Pull Requests

### Processus de PR

1. **Fork** le repository
2. **Créez** une branche depuis `main` :
   ```bash
   git checkout -b feature/nom-fonctionnalite
   # ou
   git checkout -b fix/nom-bug
   ```
3. **Développez** votre fonctionnalité ou correction
4. **Testez** localement :
   ```bash
   make start
   # Testez manuellement dans le navigateur
   ```
5. **Committez** vos changements (voir [Convention de commits](#convention-de-commits))
6. **Pushez** vers votre fork :
   ```bash
   git push origin feature/nom-fonctionnalite
   ```
7. **Ouvrez** une Pull Request vers `main`

### Convention de commits

Utilisez des messages de commit clairs et descriptifs :

**Format** :
```
Type: Description courte (max 50 caractères)

Description détaillée si nécessaire (max 72 caractères par ligne)
```

**Types** :
- `Add:` Nouvelle fonctionnalité
- `Fix:` Correction de bug
- `Update:` Mise à jour de fonctionnalité existante
- `Remove:` Suppression de code/fonctionnalité
- `Refactor:` Refactorisation sans changement de fonctionnalité
- `Docs:` Documentation uniquement
- `Style:` Formatage, CSS, pas de changement de logique
- `Test:` Ajout ou modification de tests
- `Perf:` Amélioration de performance
- `Chore:` Tâches de maintenance (build, dépendances)

**Exemples** :
```bash
git commit -m "Add: Filtrage par montant dans l'onglet liste"
git commit -m "Fix: Correction du bug de géolocalisation sur iOS"
git commit -m "Update: Amélioration de l'UI du formulaire d'ajout"
git commit -m "Docs: Ajout d'exemples dans le README"
```

### Checklist avant PR

Avant de soumettre votre PR, vérifiez :

- [ ] Le code fonctionne localement
- [ ] Les tests manuels passent
- [ ] Le code suit les [standards](#standards-de-code)
- [ ] La documentation est mise à jour si nécessaire
- [ ] Les commits suivent la convention
- [ ] Pas de fichiers sensibles (`.env`, mots de passe)
- [ ] La PR est liée à une issue existante (si applicable)

### Description de PR

**Template** :
```markdown
## Description
[Décrivez vos changements]

## Type de changement
- [ ] Bug fix (non-breaking change)
- [ ] Nouvelle fonctionnalité (non-breaking change)
- [ ] Breaking change (correction ou fonctionnalité qui casse la compatibilité)
- [ ] Documentation

## Lié à
Closes #[numéro-issue]

## Comment tester
1. [Étapes pour tester]
2. [...]

## Screenshots
[Si changements UI]

## Checklist
- [ ] Code testé localement
- [ ] Documentation mise à jour
- [ ] Commits suivent la convention
```

## Standards de code

### JavaScript

- **ES6+** : Utilisez les fonctionnalités modernes (arrow functions, async/await, destructuring)
- **Classes** : Utilisez des classes pour l'organisation
- **Const/Let** : Pas de `var`
- **Semicolons** : Toujours terminer les instructions
- **Indentation** : 4 espaces
- **Nommage** :
  - Variables/Fonctions : `camelCase`
  - Classes : `PascalCase`
  - Constantes : `UPPER_SNAKE_CASE`

**Exemple** :
```javascript
// ✅ Bon
const userName = 'John';
async function loadData() {
    const data = await fetchAPI();
    return data;
}

// ❌ Mauvais
var user_name = 'John';
function loadData(callback) {
    fetchAPI(callback)
}
```

### CSS

- **Variables CSS** : Utilisez les variables pour les couleurs, tailles
- **Mobile-first** : Utilisez `min-width` pour les media queries
- **BEM** : Pour les classes complexes (optionnel)
- **Indentation** : 4 espaces

**Exemple** :
```css
/* ✅ Bon */
.button {
    padding: var(--spacing-md);
    background: var(--accent);
}

@media (min-width: 768px) {
    .button {
        padding: var(--spacing-lg);
    }
}

/* ❌ Mauvais */
.btn {
    padding: 10px;
    background: #2563eb;
}
```

### HTML

- **Sémantique** : Utilisez les balises sémantiques (`<nav>`, `<section>`, `<article>`)
- **Accessibilité** : Ajoutez `aria-label`, `alt`, etc.
- **Indentation** : 4 espaces

## Configuration du développement

### Installation

```bash
# Cloner votre fork
git clone https://github.com/votre-username/distribution_calendriers_pompiers.git
cd distribution_calendriers_pompiers

# Ajouter le repo original comme remote
git remote add upstream https://github.com/original-username/distribution_calendriers_pompiers.git

# Installer et démarrer
cp .env.example .env
make install
```

### Workflow de développement

```bash
# Mettre à jour depuis upstream
git checkout main
git pull upstream main

# Créer une branche feature
git checkout -b feature/ma-fonctionnalite

# Développer...
# [Faire vos modifications]

# Tester
make restart
# Tester manuellement dans le navigateur

# Commit
git add .
git commit -m "Add: Ma nouvelle fonctionnalité"

# Push vers votre fork
git push origin feature/ma-fonctionnalite

# Ouvrir une PR sur GitHub
```

### Outils recommandés

- **IDE** : VSCode, WebStorm
- **Extensions VSCode** :
  - ESLint
  - Prettier
  - Docker
  - GitLens
- **Navigateurs** : Chrome/Firefox avec DevTools
- **Docker Desktop** : Pour tester localement

## Tests

Actuellement, le projet utilise des **tests manuels**. Pour tester :

```bash
# Démarrer l'application
make start

# Tester manuellement
# 1. Connexion à NocoDB
# 2. Ajouter une distribution
# 3. Modifier une distribution
# 4. Filtrer les distributions
# 5. Consulter les statistiques
# 6. Tester sur mobile (DevTools responsive)
```

**Future** : Nous prévoyons d'ajouter :
- Tests unitaires (Jest)
- Tests E2E (Playwright/Cypress)

## Besoin d'aide ?

- 💬 **Discussions** : [GitHub Discussions](https://github.com/votre-username/distribution_calendriers_pompiers/discussions)
- 📧 **Email** : support@example.com
- 📖 **Documentation** : [README.md](README.md) et [DEPLOYMENT.md](DEPLOYMENT.md)

---

**Merci de contribuer à améliorer l'application ! 🚒❤️**
