// Provider data will be loaded from external JSON file
let providerData = null;
let crisisData = null;
let orgData = null;
var roiChartInstance = null;
var roiHumanImpactChartInstance = null;
Chart.defaults.font.family = "var(--font-family-base)";

// Load provider data from JSON file
async function loadProviderData() {
  try {
    const response = await fetch('data/provider_data.json');
    if (!response.ok) {
      throw new Error(`Failed to load data: ${response.status}`);
    }
    providerData = await response.json();
    console.log('✅ Provider data loaded successfully');
    return providerData;
  } catch (error) {
    console.error('❌ Error loading provider data:', error);
    const mainContent = document.getElementById('main-content');
    if (mainContent) {
      mainContent.innerHTML = `
        <div style="padding: 2rem; text-align: center; color: var(--text-primary);">
          <h2>Unable to Load Content</h2>
          <p>Please refresh the page. If the problem persists, contact support.</p>
          <p style="font-size: 0.875rem; color: var(--text-secondary); margin-top: 1rem;">
            Error: ${error.message}
          </p>
        </div>
      `;
    }
    throw error;
  }
}

let currentProvider = null;
let currentCategory = 'mental';

// Initialize app
async function init() {
	// Load data before anything else
  try {
    await loadProviderData();
	await loadCrisisData();
	await initializeOrganizationFeatures();
  } catch (error) {
    // Error already handled in loadProviderData, just return
    return;
  }
  
  setupEventListeners();
  setupSearch();
  
  // Handle hash-based routing
  handleRouting();
    
  // Listen for hash changes (back/forward buttons, manual hash changes)
  window.addEventListener('hashchange', () => {
    handleRouting();
  });
}

// Setup event listeners
function setupEventListeners() {
  // Mobile menu toggle
  const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
  const mobileMenu = document.querySelector('.mobile-menu');
  
  if (mobileMenuToggle) {
    mobileMenuToggle.addEventListener('click', () => {
      mobileMenu.classList.toggle('active');
    });
  }

    // Theme toggle functionality
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        // Check for manual override in localStorage
        const savedTheme = localStorage.getItem('theme');

        if (savedTheme) {
            // User has manually set a preference - use it
            document.documentElement.setAttribute('data-color-scheme', savedTheme);
			updateFavicon(savedTheme);
        } else {
            // No manual preference - detect system preference
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            const systemTheme = prefersDark ? 'dark' : 'light';
            document.documentElement.setAttribute('data-color-scheme', systemTheme);
			updateFavicon(systemTheme);
        }

        themeToggle.addEventListener('click', () => {
            const theme = document.documentElement.getAttribute('data-color-scheme');
            const newTheme = theme === 'light' ? 'dark' : 'light';

            document.documentElement.setAttribute('data-color-scheme', newTheme);
            localStorage.setItem('theme', newTheme);
			updateFavicon(newTheme);
        });
    }
	
	// Update favicon based on theme
	function updateFavicon(theme) {
	  const favicon = document.getElementById('favicon');
	  if (favicon) {
		if (theme === 'dark') {
		  favicon.href = 'src/favicon_dark.jpg';
		} else {
		  favicon.href = 'src/favicon_light.jpg';
		}
	  }
	}

  // Navigation links
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const section = e.target.dataset.section;
      window.location.hash = section === 'home' ? '' : section;
      if (mobileMenu) {
        mobileMenu.classList.remove('active');
      }
    });
  });

  // Provider cards
  const providerCards = document.querySelectorAll('.provider-card');
  providerCards.forEach(card => {
  card.addEventListener('click', () => {
    const provider = card.dataset.provider;
    window.location.hash = `provider/${provider}`;
    });
  });

  // Back button
  const backButton = document.getElementById('backButton');
  if (backButton) {
    backButton.addEventListener('click', () => {
      window.location.hash = '';
    });
  }

  // Category tabs
  const categoryTabs = document.querySelectorAll('.category-tab');
  categoryTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      const category = e.target.dataset.category;
      if (currentProvider) {
        window.location.hash = `provider/${currentProvider}/${category}`;
      }
    });
  });
}

// Setup search functionality
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');
  
  if (searchInput) {
    // Handle input with debouncing
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        const searchTerm = e.target.value.toLowerCase().trim();
        performSearch(searchTerm);
      }, 300); // 300ms debounce
    });

    // Handle focus - show results if search has value
    searchInput.addEventListener('focus', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      if (searchTerm.length >= 2) {
        performSearch(searchTerm);
      }
    });

    // Close search results when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
        hideSearchResults();
      }
    });
  }
}

// Enhanced HTML stripping that preserves context
function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    
    // Add spaces around block elements to prevent word concatenation
    const blockElements = tmp.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li, td, th, br');
    blockElements.forEach(el => {
        el.insertAdjacentText('afterend', ' ');
    });
    
    // Extract text content
    let text = tmp.textContent || tmp.innerText || '';
    
    // Clean up excessive whitespace while preserving single spaces
    text = text.replace(/\s+/g, ' ').trim();
    
    return text;
}

// Enhanced search helper with fuzzy matching
function searchInContent(content, searchTerm) {
    if (!content) return false;
    
    const text = stripHtml(content).toLowerCase();
    const term = searchTerm.toLowerCase().trim();
    
    // Exact phrase match (highest priority)
    if (text.includes(term)) return true;
    
    // Fuzzy match: check if all words in search term exist in content
    const words = term.split(/\s+/).filter(w => w.length > 0);
    return words.every(word => text.includes(word));
}

// Extract context snippet with search term highlighted
function getContextSnippet(content, searchTerm, maxLength = 150) {
    if (!content || !searchTerm) return '';
    
    const text = stripHtml(content);
    const lowerText = text.toLowerCase();
    const lowerTerm = searchTerm.toLowerCase();
    
    // Find first occurrence of any search word
    const words = lowerTerm.split(/\s+/).filter(w => w.length > 0);
    let firstIndex = -1;
    let matchedWord = '';
    
    for (const word of words) {
        const index = lowerText.indexOf(word);
        if (index !== -1 && (firstIndex === -1 || index < firstIndex)) {
            firstIndex = index;
            matchedWord = word;
        }
    }
    
    if (firstIndex === -1) return text.substring(0, maxLength) + '...';
    
    // Calculate snippet boundaries
    const halfLength = Math.floor(maxLength / 2);
    let start = Math.max(0, firstIndex - halfLength);
    let end = Math.min(text.length, firstIndex + matchedWord.length + halfLength);
    
    // Adjust to word boundaries
    if (start > 0) {
        const spaceIndex = text.lastIndexOf(' ', start);
        if (spaceIndex > 0) start = spaceIndex + 1;
    }
    if (end < text.length) {
        const spaceIndex = text.indexOf(' ', end);
        if (spaceIndex > 0) end = spaceIndex;
    }
    
    let snippet = text.substring(start, end);
    
    // Add ellipsis
    if (start > 0) snippet = '...' + snippet;
    if (end < text.length) snippet = snippet + '...';
    
    // Highlight all search words (case-insensitive)
    words.forEach(word => {
        const regex = new RegExp(`(${word})`, 'gi');
        snippet = snippet.replace(regex, '<mark>$1</mark>');
    });
    
    return snippet;
}

// Calculate relevance score for a search result
function calculateRelevanceScore(result, searchTerm) {
    let score = 0;
    const lowerTerm = searchTerm.toLowerCase();
    const lowerTitle = result.title.toLowerCase();
    const lowerSnippet = (result.snippet || '').toLowerCase().replace(/<[^>]*>/g, '');
    const lowerProvider = (result.providerTitle || '').toLowerCase();
    const searchWords = lowerTerm.split(/\s+/).filter(w => w.length > 0);
    
    // 1. Exact title match (highest priority)
    if (lowerTitle === lowerTerm) {
        score += 100;
    } 
    // 2. Title starts with search term
    else if (lowerTitle.startsWith(lowerTerm)) {
        score += 50;
    } 
    // 3. Title contains exact phrase
    else if (lowerTitle.includes(lowerTerm)) {
        score += 40;
    }
    
    // 4. All search words in title
    const allWordsInTitle = searchWords.every(word => lowerTitle.includes(word));
    if (allWordsInTitle) {
        score += 30;
    }
    
    // 5. Each word found in title
    searchWords.forEach(word => {
        if (lowerTitle.includes(word)) {
            score += 10;
        }
    });
    
    // 6. Provider name contains search word
    searchWords.forEach(word => {
        if (lowerProvider.includes(word)) {
            score += 25;
        }
    });
    
    // 7. Exact provider match
    if (searchWords.some(word => lowerProvider === word)) {
        score += 50;
    }
    
    // 8. Exact phrase in snippet
    if (lowerSnippet.includes(lowerTerm)) {
        score += 25; // Upped from 5
    }
    
    // 9. Each search word in snippet
    searchWords.forEach(word => {
        if (lowerSnippet.includes(word)) {
            score += 5; // +5 for each word
        }
    });
    
    const typeScores = {
        'Crisis': 30,         // High importance
        'Introduction': 30,   // Good overview
        'Detailed Guide': 25, // Very relevant
        'Strategy': 20,       // Actionable
        'Key Points': 20,     // Good summary
        'Stressor': 15,       // Problem identification
        'Resource': 15,       // Helpful resources
        'Focus Area': 15      // Specific topics
    };
    score += typeScores[result.type] || 10; // Default score of 10
    
    return score;
}

/*Context-Aware provider_data Search*/
function searchProvider(providerId, providerInfo, normalizedTerm) {
  const providerResults = [];
  const providerTitle = providerInfo.title;

  Object.entries(providerInfo).forEach(([categoryId, categoryData]) => {
    // Skip the title property
    if (categoryId === 'title') return;
    
    // Determine the category title for display (Mental Health or Physical Health)
    const categoryTitle = categoryId.includes('mental') ? 'Mental Health' : 'Physical Health';
    
    // Search in introduction
    if (categoryData.introduction && searchInContent(categoryData.introduction, normalizedTerm)) {
        const snippet = getContextSnippet(categoryData.introduction, normalizedTerm);
        providerResults.push({
            provider: providerId,
            providerTitle: providerTitle,
            category: categoryId,
            categoryTitle: categoryTitle,
            type: 'Introduction',
            title: `${providerTitle} - ${categoryTitle}`,
            snippet: snippet,
            section: 'introduction'
        });
    }

    // Search in stressors
    if (categoryData.stressors && Array.isArray(categoryData.stressors)) {
        categoryData.stressors.forEach((stressor, index) => {
            if (searchInContent(stressor.title, normalizedTerm) || 
                searchInContent(stressor.detail, normalizedTerm)) {
    
                const matchedContent = searchInContent(stressor.detail, normalizedTerm) ? 
                    stressor.detail : stressor.title;
                const snippet = getContextSnippet(matchedContent, normalizedTerm);
    
                providerResults.push({
                    provider: providerId,
                    providerTitle: providerTitle,
                    category: categoryId,
                    categoryTitle: categoryTitle,
                    type: 'Stressor',
                    title: stressor.title,
                    snippet: snippet,
                    section: 'stressors',
                    index: index
                });
            }
        });
    }

    // Search in strategies
    if (categoryData.strategies && Array.isArray(categoryData.strategies)) {
        categoryData.strategies.forEach((strategy, index) => {
            if (searchInContent(strategy.title, normalizedTerm) || 
                searchInContent(strategy.detail, normalizedTerm)) {
    
                const matchedContent = searchInContent(strategy.detail, normalizedTerm) ? 
                    strategy.detail : strategy.title;
                const snippet = getContextSnippet(matchedContent, normalizedTerm);
    
                providerResults.push({
                    provider: providerId,
                    providerTitle: providerTitle,
                    category: categoryId,
                    categoryTitle: categoryTitle,
                    type: 'Strategy',
                    title: strategy.title,
                    snippet: snippet,
                    section: 'strategies',
                    index: index
                });
            }
        });
    }

    // Search in resources
    if (categoryData.resources && Array.isArray(categoryData.resources)) {
        categoryData.resources.forEach((resource, index) => {
            if (searchInContent(resource.name, normalizedTerm) || 
                searchInContent(resource.description, normalizedTerm)) {
    
                const matchedContent = searchInContent(resource.description, normalizedTerm) ? 
                    resource.description : resource.name;
                const snippet = getContextSnippet(matchedContent, normalizedTerm);
    
                providerResults.push({
                    provider: providerId,
                    providerTitle: providerTitle,
                    category: categoryId,
                    categoryTitle: categoryTitle,
                    type: 'Resource',
                    title: resource.name,
                    snippet: snippet,
                    section: 'resources',
                    index: index
                });
            }
        });
    }

    // Search in focus_areas
    if (categoryData.focus_areas && Array.isArray(categoryData.focus_areas)) {
        categoryData.focus_areas.forEach((area, index) => {
            if (searchInContent(area.title, normalizedTerm) || 
                searchInContent(area.detail, normalizedTerm)) {
    
                const matchedContent = searchInContent(area.detail, normalizedTerm) ? 
                    area.detail : area.title;
                const snippet = getContextSnippet(matchedContent, normalizedTerm);
    
                providerResults.push({
                    provider: providerId,
                    providerTitle: providerTitle,
                    category: categoryId,
                    categoryTitle: categoryTitle,
                    type: 'Focus Area',
                    title: area.title,
                    snippet: snippet,
                    section: 'focus_areas',
                    index: index
                });
            }
        });
    }
	
    // Search in detailedGuide
    if (categoryData.detailedGuide && searchInContent(categoryData.detailedGuide, normalizedTerm)) {
        const snippet = getContextSnippet(categoryData.detailedGuide, normalizedTerm);
        providerResults.push({
            provider: providerId,
            providerTitle: providerTitle,
            category: categoryId,
            categoryTitle: categoryTitle,
            type: 'Detailed Guide',
            title: `${providerTitle} - ${categoryTitle} Guide`,
            snippet: snippet,
            section: 'detailedGuide'
        });
    }

    // Search in key_points
    if (categoryData.key_points && Array.isArray(categoryData.key_points)) {
        const keyPointsText = categoryData.key_points.join(' ');
        if (searchInContent(keyPointsText, normalizedTerm)) {
            const snippet = getContextSnippet(keyPointsText, normalizedTerm);
            providerResults.push({
                provider: providerId,
                providerTitle: providerTitle,
                category: categoryId,
                categoryTitle: categoryTitle, // Will be Physical Health
                type: 'Key Points',
                title: `${providerTitle} - Key Points`,
                snippet: snippet,
                section: 'key_points'
            });
        }
    }

  });

  return providerResults;
}

/*Crisis Data search on Homepage*/
function searchCrisis(normalizedTerm) {
    const results = [];
    if (!crisisData || !crisisData.resources) return results;

    crisisData.resources.forEach(resource => {
        if (searchInContent(resource.name, normalizedTerm) || 
            searchInContent(resource.description, normalizedTerm) || 
            searchInContent(resource.description_expanded, normalizedTerm)) {
            
            const matchedContent = resource.description_expanded || resource.description || resource.name;
            const snippet = getContextSnippet(matchedContent, normalizedTerm);

            results.push({
                type: 'Crisis',
                title: resource.name,
                snippet: snippet,
                id: resource.id,
                providerTitle: 'Crisis Resources',
                categoryTitle: resource.category_id.replace('_', ' ')
            });
        }
    });
    return results;
}

/*Organization Data Search on Homepage*/
function searchOrg(normalizedTerm) {
    const results = [];
    if (!orgData || !orgData.categories) return results;

    orgData.categories.forEach(category => {
        category.strategies.forEach(strategy => {
            if (searchInContent(strategy.title, normalizedTerm) || 
                searchInContent(strategy.description, normalizedTerm) || 
                searchInContent(strategy.introduction, normalizedTerm)) {
                
                const matchedContent = strategy.introduction || strategy.description || strategy.title;
                const snippet = getContextSnippet(matchedContent, normalizedTerm);

                results.push({
                    type: 'Strategy',
                    title: strategy.title,
                    snippet: snippet,
                    id: strategy.id,
                    providerTitle: 'Organizational',
                    categoryTitle: category.name,
                    categoryId: category.id
                });
            }
        });
    });
    return results;
}

// Perform search
function performSearch(searchTerm) {
    const searchResults = document.getElementById('searchResults');
    if (!searchResults) return;
    
    // Clear results if search is too short
    if (!searchTerm || searchTerm.length < 2) {
        hideSearchResults();
        return;
    }
    if (!providerData || !crisisData || !orgData) { // Check all data sources
		console.warn('Search attempted before all data was loaded');
		searchResults.innerHTML = '<div class="search-no-results">Loading data, please try again...</div>';
		searchResults.classList.remove('hidden');
		return;
	}
    
    let results = [];
    const normalizedTerm = searchTerm.toLowerCase().trim();
    
    // Check if we are on a provider page or homepage
    if (currentProvider) {
        // --- SCOPED PROVIDER SEARCH ---
        // Search only the currently active provider
        const providerInfo = providerData[currentProvider];
        if (providerInfo) {
            results = searchProvider(currentProvider, providerInfo, normalizedTerm);
        }
    } else {
        // --- GLOBAL SEARCH ---
        // Search all providers
        Object.entries(providerData).forEach(([providerId, providerInfo]) => {
            const providerResults = searchProvider(providerId, providerInfo, normalizedTerm);
            results.push(...providerResults);
        });
        
        // Search Crisis Data
        const crisisResults = searchCrisis(normalizedTerm);
        results.push(...crisisResults);
        
        // Search Org Data
        const orgResults = searchOrg(normalizedTerm);
        results.push(...orgResults);
    }
    
	// Sort results by relevance score (highest first)
	results.sort((a, b) => {
		const scoreA = calculateRelevanceScore(a, searchTerm);
		const scoreB = calculateRelevanceScore(b, searchTerm);
		return scoreB - scoreA;
	});
	
    // Display results
    displaySearchResults(results, searchTerm);
}

// Display search results in dropdown
function displaySearchResults(results, searchTerm) {
  const searchResults = document.getElementById('searchResults');
  
  if (!searchResults) return;
  
  // Clear previous results
  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    let message = `No results found for "${searchTerm}"`;
    if (currentProvider && providerData[currentProvider]) {
        // We are in a scoped search, make the message more specific
        message += ` in ${providerData[currentProvider].title} resources.`;
    }
    searchResults.innerHTML = `<div class="search-no-results">${message}</div>`;
    searchResults.classList.remove('hidden');
    return;
  }

  // Limit to top 10 results
  const limitedResults = results.slice(0, 10);
  
  limitedResults.forEach(result => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    
    // Format the result display with snippet
	resultItem.innerHTML = `
		<div class="search-result-title">${result.title}</div>
		${result.snippet ? `<div class="search-result-snippet">${result.snippet}</div>` : ''}
		<div class="search-result-category">
			<span class="search-result-provider">${result.providerTitle}</span>
			<span class="search-result-separator"> • </span>
			<span class="search-result-cat">${result.categoryTitle}</span>
			<span class="search-result-separator"> • </span>
			<span class="search-result-type">${result.type}</span>
		</div>
`	;

    
    // Make it clickable - navigate to the content
	resultItem.addEventListener('click', () => {
		// Hide search first
		hideSearchResults();
		clearSearchInput();
        
        // --- NEW ROUTING LOGIC ---
        if (result.type === 'Crisis') {
            window.location.hash = 'crisis';
            // Wait for navigation, then find and highlight the card
            setTimeout(() => {
                const card = document.querySelector(`.crisis-card[data-resource="${result.id}"]`);
                if (card) {
                    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    card.style.backgroundColor = 'var(--color-secondary-hover)';
                    setTimeout(() => {
                        card.style.transition = 'background-color 1s ease';
                        card.style.backgroundColor = '';
                    }, 2000);
                }
            }, 500);

        } else if (result.type === 'Strategy' && result.providerTitle === 'Organizational') {
            window.location.hash = 'organizational';
            // Wait for navigation, then call the org scroll function
            setTimeout(() => {
                navigateToOrgResult(result.type.toLowerCase(), result.id, result.categoryId);
            }, 500);
            
        } else {
            // --- Original Provider Logic ---
            // Convert category format: 'mentalhealth' -> 'mental', 'physicalhealth' -> 'physical'
            let categoryShort;
            if (result.type === 'Resource' || result.section === 'resources') {
                categoryShort = 'resources';
            } else {
                categoryShort = result.category.includes('mental') ? 'mental' : 'physical';
            }
        
            // Build the CORRECT hash URL format: #provider/{providerId}/{category}
            const hash = `#provider/${result.provider}/${categoryShort}`;
            window.location.hash = hash;

            // Wait for navigation and tab switching to complete, then scroll
            setTimeout(() => {
                if (result.section) {
                    scrollToSection(result.section, result.title, result.category);
                }
            }, 500); // Increased to 500ms to allow tab switch to complete
        }
	});

    
    searchResults.appendChild(resultItem);
  });
  
  searchResults.classList.remove('hidden');
}

// Navigate to specific content
function navigateToContent(result) {
  // First, show the provider detail page
  showProviderDetail(result.provider);
  
  // Switch to correct category (mental or physical health)
  const category = result.category === 'mentalhealth' ? 'mental' : 'physical';
  switchCategory(category);
  
  // Wait for content to load, then scroll to section
  setTimeout(() => {
    scrollToSection(result.section, result.title);
  }, 300);
}

// Scroll to specific section and highlight it
function scrollToSection(section, title, category, retries = 3) {
    // Determine category type (mental or physical)
    let categoryType = currentCategory;
    
    if (category) {
        categoryType = category.includes('mental') ? 'mental' : 
                      category.includes('physical') ? 'physical' : 
                      currentCategory;
    }
    
    const sectionMap = {
        'stressors': 'stressors-list',
        'strategies': 'strategies-list',
        'focus_areas': 'focus-areas-list',
        'resources': 'resources-content',
        'introduction': categoryType === 'mental' ? 'mental-introduction' : 'physical-introduction',
        'detailedGuide': categoryType === 'mental' ? 'mental-detailed-guide' : 'physical-detailed-guide',
        'key_points': 'key-points-section'
    };
    
    const targetId = sectionMap[section];
    if (!targetId) {
        console.warn(`No mapping found for section: ${section}`);
        return;
    }
    
    const targetElement = document.getElementById(targetId);
    if (!targetElement) {
        // Element not found - retry if we have retries left
        if (retries > 0) {
            console.log(`Element ${targetId} not ready. Retrying in 200ms... (${retries} left)`);
            setTimeout(() => {
                scrollToSection(section, title, category, retries - 1);
            }, 200);
            return;
        } else {
            console.warn(`Failed to find element: ${targetId}`);
            return;
        }
    }
    
    // For container sections (introduction, etc.)
    if (section === 'introduction' || section === 'detailedGuide' || section === 'key_points') {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        
        const originalBackground = targetElement.style.backgroundColor;
        targetElement.style.backgroundColor = 'var(--color-secondary)';
        setTimeout(() => {
            targetElement.style.transition = 'background-color 1s ease';
            targetElement.style.backgroundColor = originalBackground;
        }, 2000);
        
        return;
    }
    
    // For list-based sections - find specific item
    const items = targetElement.querySelectorAll('.expandable-item, .resource-card');
    
    if (items.length === 0 && retries > 0) {
        // Items not rendered yet - retry
        console.log(`Items in ${targetId} not rendered. Retrying in 200ms... (${retries} left)`);
        setTimeout(() => {
            scrollToSection(section, title, category, retries - 1);
        }, 200);
        return;
    }
    
    let targetItem = null;
    items.forEach(item => {
        const itemText = item.textContent || item.innerText;
        if (itemText.toLowerCase().includes(title.toLowerCase())) {
            targetItem = item;
        }
    });
    
    if (targetItem) {
        // Scroll to specific item
        targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Expand if expandable
        const header = targetItem.querySelector('.item-header');
        if (header) {
            const detailDiv = targetItem.querySelector('.item-detail');
            if (detailDiv && detailDiv.classList.contains('is-collapsed')) {
                header.click();
            }
        }
        
        // Highlight
        targetItem.style.backgroundColor = 'var(--color-teal-100, rgba(224, 247, 250, 0.5))';
        setTimeout(() => {
            targetItem.style.transition = 'background-color 1s ease';
            targetItem.style.backgroundColor = '';
        }, 2000);
    } else {
        // Fallback: scroll to section container
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Helper function to format section names
function formatSectionName(section) {
  const names = {
    'stressors': 'Stressors',
    'strategies': 'Strategies',
    'focus_areas': 'Focus Areas',
    'resources': 'Resources'
  };
  return names[section] || section;
}

// Hide search results dropdown
function hideSearchResults() {
  const searchResults = document.getElementById('searchResults');
  if (searchResults) {
    searchResults.classList.add('hidden');
  }
}

// Clear search input
function clearSearchInput() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = '';
  }
}

// Handle hash-based routing for GitHub Pages
function handleRouting() {
    const hash = window.location.hash.slice(1); // Remove the # symbol
    
    if (!hash || hash === '' || hash === 'home') {
        navigateToSection('home');
    } else if (hash.startsWith('provider/')) {
        const parts = hash.split('/').filter(p => p);
        const provider = parts[1];
        if (provider && providerData[provider]) {
            showProviderDetail(provider);
            if (parts[2]) {
                switchCategory(parts[2]);
            }
        } else {
            // Invalid provider, go to home
            navigateToSection('home');
        }
    } else if (hash === 'crisis') {
        navigateToSection('crisis');
    } else if (hash === 'organizational') {
        navigateToSection('organizational');
    } else {
        // Unknown route, default to home
        navigateToSection('home');
    }
}

// Navigate to section
function navigateToSection(section) {
  // Get the global search bar container
  const globalSearchContainer = document.getElementById('searchInput').closest('.search-container');

  // Hide all sections
  document.getElementById('home').classList.add('hidden');
  document.querySelector('.provider-selection').classList.add('hidden');
  document.getElementById('provider-detail').classList.add('hidden');
  document.getElementById('crisis-section').classList.add('hidden');
  document.getElementById('organizational').classList.add('hidden');

  // Show requested section and toggle search bar
  if (section === 'home') {
    document.getElementById('home').classList.remove('hidden');
    document.querySelector('.provider-selection').classList.remove('hidden');
    globalSearchContainer.classList.remove('hidden'); // SHOW search
	currentProvider = null;
	document.getElementById('searchInput').placeholder = "Search all wellness resources...";
  } else if (section === 'crisis') {
    document.getElementById('crisis-section').classList.remove('hidden');
    globalSearchContainer.classList.add('hidden'); // HIDE search
  } else if (section === 'organizational') {
    document.getElementById('organizational').classList.remove('hidden');
    globalSearchContainer.classList.add('hidden'); // HIDE search
  }

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Show provider detail
function showProviderDetail(providerKey) {
  document.getElementById('searchInput').closest('.search-container').classList.remove('hidden');
  currentProvider = providerKey;
  const provider = providerData[providerKey];
  document.getElementById('searchInput').placeholder = `Search in ${provider.title} resources...`;

  // Hide home sections
  document.getElementById('home').classList.add('hidden');
  document.querySelector('.provider-selection').classList.add('hidden');

  // Show provider detail
  const detailSection = document.getElementById('provider-detail');
  detailSection.classList.remove('hidden');

  // Update title
  document.getElementById('providerTitle').textContent = provider.title + ' Wellness Resources';

  // Reset to mental health tab
  switchCategory('mental');
  loadProviderContent();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Switch between mental, physical health, and resources categories
function switchCategory(category) {
    
  currentCategory = category;
  
  // Update tab states
  const tabs = document.querySelectorAll('.category-tab');
  tabs.forEach(tab => {
    if (tab.dataset.category === category) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  // Show/hide content
  const mentalContent = document.getElementById('mental-health-content');
  const physicalContent = document.getElementById('physical-health-content');
  const resourcesContent = document.getElementById('resources-content');
  
  // Hide all content sections first
  mentalContent.classList.add('hidden');
  physicalContent.classList.add('hidden');
  if (resourcesContent) {
    resourcesContent.classList.add('hidden');
  }
  
  // Show the selected category
  if (category === 'mental') {
    mentalContent.classList.remove('hidden');
  } else if (category === 'physical') {
    physicalContent.classList.remove('hidden');
  } else if (category === 'resources' && resourcesContent) {
    resourcesContent.classList.remove('hidden');
  }
  
  loadProviderContent();
}

// Load provider content
function loadProviderContent() {
  if (!currentProvider) return;
  
  const provider = providerData[currentProvider];
  
  if (currentCategory === 'mental') {
    loadMentalHealthContent(provider.mentalhealth);
  } else if (currentCategory === 'physical') {
    loadPhysicalHealthContent(provider.physicalhealth);
  } else if (currentCategory === 'resources') {
    loadResourcesContent(currentProvider);
  }
}

// Load mental health content
function loadMentalHealthContent(data) {
  // Add introduction if exists
  const mentalHealthContent = document.getElementById('mental-health-content');
  
  // Check if intro section already exists, if not create it
  let introSection = mentalHealthContent.querySelector('.intro-section');
  if (!introSection) {
    introSection = document.createElement('div');
    introSection.className = 'intro-section';
	introSection.id = 'mental-introduction';
    mentalHealthContent.insertBefore(introSection, mentalHealthContent.firstChild);
  }
  introSection.innerHTML = data.introduction || '';

  // Load stressors with expandable details
  const stressorsList = document.getElementById('stressors-list');
  stressorsList.innerHTML = '';
  data.stressors.forEach((stressor, index) => {
    const li = document.createElement('li');
    li.className = 'expandable-item';
    
    const title = typeof stressor === 'string' ? stressor : stressor.title;
    const detail = typeof stressor === 'object' ? stressor.detail : '';
    
    li.innerHTML = `
      <div class="item-header" data-toggle="stressor-${index}">
        <strong>${title}</strong>
        ${detail ? '<svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' : ''}
      </div>
      ${detail ? `<div class="item-detail is-collapsed" id="stressor-${index}">${detail}</div>` : ''}
    `;
    
    // Add click handler for expandable items
    if (detail) {
      const header = li.querySelector('.item-header');
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const detailDiv = li.querySelector('.item-detail');
        const icon = li.querySelector('.expand-icon');
        detailDiv.classList.toggle('is-collapsed');
        icon.style.transform = detailDiv.classList.contains('is-collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }
    
    stressorsList.appendChild(li);
  });

  // Load strategies with expandable details
  const strategiesList = document.getElementById('strategies-list');
  strategiesList.innerHTML = '';
  data.strategies.forEach((strategy, index) => {
    const li = document.createElement('li');
    li.className = 'expandable-item';
    
    const title = typeof strategy === 'string' ? strategy : strategy.title;
    const detail = typeof strategy === 'object' ? strategy.detail : '';
    
    li.innerHTML = `
      <div class="item-header" data-toggle="strategy-${index}">
        <strong>${title}</strong>
        ${detail ? '<svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' : ''}
      </div>
      ${detail ? `<div class="item-detail is-collapsed" id="strategy-${index}">${detail}</div>` : ''}
    `;
    
    // Add click handler for expandable items
    if (detail) {
      const header = li.querySelector('.item-header');
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const detailDiv = li.querySelector('.item-detail');
        const icon = li.querySelector('.expand-icon');
        detailDiv.classList.toggle('is-collapsed');
        icon.style.transform = detailDiv.classList.contains('is-collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }
    
    strategiesList.appendChild(li);
  });

  // Add detailed guide if exists
  let guideSection = mentalHealthContent.querySelector('.guide-section-wrapper');
  if (data.detailedGuide) {
    if (!guideSection) {
      guideSection = document.createElement('div');
      guideSection.className = 'guide-section-wrapper';
	  guideSection.id = 'mental-detailed-guide';
      // Insert before resources section
      const resourcesSection = mentalHealthContent.querySelector('.resources-section');
      mentalHealthContent.insertBefore(guideSection, resourcesSection);
    }
    guideSection.innerHTML = data.detailedGuide;
  } else if (guideSection) {
    guideSection.remove();
  }

  // Add statistics if exists
  if (data.statistics) {
    let statsSection = mentalHealthContent.querySelector('.statistics-section');
    if (!statsSection) {
      statsSection = document.createElement('div');
      statsSection.className = 'statistics-section';
      mentalHealthContent.appendChild(statsSection);
    }
    
    statsSection.innerHTML = `
      <h3>Key Statistics</h3>
      <div class="stats-grid">
        ${data.statistics.map(stat => `
          <div class="stat-box">
            <div class="stat-value">${stat.value}</div>
            <div class="stat-description">${stat.label}</div>
            ${stat.source ? `<div class="stat-source">Source: ${stat.source}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }
}

// Load physical health content
function loadPhysicalHealthContent(data) {
  const physicalHealthContent = document.getElementById('physical-health-content');
  
  // Add introduction if exists
  let introSection = physicalHealthContent.querySelector('.intro-section');
  if (!introSection) {
    introSection = document.createElement('div');
    introSection.className = 'intro-section';
	introSection.id = 'physical-introduction';
    physicalHealthContent.insertBefore(introSection, physicalHealthContent.firstChild);
  }
  introSection.innerHTML = data.introduction || '';

  // Load focus areas with expandable details
  const focusAreasList = document.getElementById('focus-areas-list');
  focusAreasList.innerHTML = '';
  data.focus_areas.forEach((area, index) => {
    const li = document.createElement('li');
    li.className = 'expandable-item';
    
    const title = typeof area === 'string' ? area : area.title;
    const detail = typeof area === 'object' ? area.detail : '';
    
    li.innerHTML = `
      <div class="item-header" data-toggle="focus-${index}">
        <strong>${title}</strong>
        ${detail ? '<svg class="expand-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>' : ''}
      </div>
      ${detail ? `<div class="item-detail is-collapsed" id="focus-${index}">${detail}</div>` : ''}
    `;
    
    // Add click handler for expandable items
    if (detail) {
      const header = li.querySelector('.item-header');
      header.style.cursor = 'pointer';
      header.addEventListener('click', () => {
        const detailDiv = li.querySelector('.item-detail');
        const icon = li.querySelector('.expand-icon');
        detailDiv.classList.toggle('is-collapsed');
        icon.style.transform = detailDiv.classList.contains('is-collapsed') ? 'rotate(0deg)' : 'rotate(180deg)';
      });
    }
    
    focusAreasList.appendChild(li);
  });

  // Load key points
  const keyPointsList = document.getElementById('key-points-list');
  if (keyPointsList && keyPointsList.parentElement) {
    keyPointsList.parentElement.id = 'key-points-section';
}
  keyPointsList.innerHTML = '';
  data.key_points.forEach(point => {
    const li = document.createElement('li');
    li.textContent = point;
    keyPointsList.appendChild(li);
  });

  // Add detailed guide if exists
  let guideSection = physicalHealthContent.querySelector('.guide-section-wrapper');
  if (data.detailedGuide) {
    if (!guideSection) {
      guideSection = document.createElement('div');
      guideSection.className = 'guide-section-wrapper';
	  guideSection.id = 'physical-detailed-guide';
      // Insert before stats section
      const statsSection = physicalHealthContent.querySelector('.physical-health-stats');
      physicalHealthContent.insertBefore(guideSection, statsSection);
    }
    guideSection.innerHTML = data.detailedGuide;
  } else if (guideSection) {
    guideSection.remove();
  }

  // Update statistics if exists
  if (data.statistics) {
    const statsGrid = physicalHealthContent.querySelector('.stats-grid');
    if (statsGrid) {
      statsGrid.innerHTML = data.statistics.map(stat => `
        <div class="stat-box">
          <div class="stat-value">${stat.value}</div>
          <div class="stat-description">${stat.label}</div>
          ${stat.source ? `<div class="stat-source">Source: ${stat.source}</div>` : ''}
        </div>
      `).join('');
    }
  }
 } 
 
function loadResourcesContent(providerType) {
  const data = providerData[providerType];
  
  if (!data) {
    return;
  }
  
  const resourcesContent = document.getElementById('resources-content');
  if (!resourcesContent) return;
  
  // Clear existing content
  resourcesContent.innerHTML = '';
  
  // Create main container with width constraint
  const mainContainer = document.createElement('div');
  mainContainer.className = 'resources-section';
  mainContainer.style.maxWidth = '100%'; // Ensure it doesn't exceed parent
  mainContainer.style.margin = '0 auto';  // Center it
  
  // Add main title
  const mainTitle = document.createElement('h3');
  mainTitle.textContent = 'Professional Resources & Support';
  mainContainer.appendChild(mainTitle);
  
  // Mental Health Resources Section
  if (data.mentalhealth && data.mentalhealth.resources) {
    const mentalSection = document.createElement('div');
    mentalSection.className = 'resource-category';
    
    const mentalTitle = document.createElement('h4');
    mentalTitle.textContent = 'Mental Health Resources';
    mentalTitle.style.marginTop = '1.5rem';
    mentalTitle.style.marginBottom = '1rem';
    mentalSection.appendChild(mentalTitle);
    
    const mentalGrid = document.createElement('div');
    mentalGrid.className = 'resources-grid';
    
    data.mentalhealth.resources.forEach(resource => {
      const card = createResourceCard(resource);
      mentalGrid.appendChild(card);
    });
    
    mentalSection.appendChild(mentalGrid);
    mainContainer.appendChild(mentalSection);
  }
  
  // Physical Health Resources Section
  if (data.physicalhealth && data.physicalhealth.resources) {
    const physicalSection = document.createElement('div');
    physicalSection.className = 'resource-category';
    
    const physicalTitle = document.createElement('h4');
    physicalTitle.textContent = 'Physical Health Resources';
    physicalTitle.style.marginTop = '2rem';
    physicalTitle.style.marginBottom = '1rem';
    physicalSection.appendChild(physicalTitle);
    
    const physicalGrid = document.createElement('div');
    physicalGrid.className = 'resources-grid';
    
    data.physicalhealth.resources.forEach(resource => {
      const card = createResourceCard(resource);
      physicalGrid.appendChild(card);
    });
    
    physicalSection.appendChild(physicalGrid);
    mainContainer.appendChild(physicalSection);
  }
  
  resourcesContent.appendChild(mainContainer);
}

// Helper function to create resource cards
function createResourceCard(resource) {
  const card = document.createElement('div');
  card.className = 'resource-card';
  
  const name = typeof resource === 'string' ? resource : resource.name;
  const description = typeof resource === 'string' ? '' : resource.description;
  const type = typeof resource === 'object' ? resource.type : '';
  const url = typeof resource === 'object' ? resource.url : null;
  
  // If URL exists, make the card a clickable link
  if (url) {
    card.style.cursor = 'pointer';
    card.setAttribute('role', 'link');
    card.setAttribute('tabindex', '0');
    card.onclick = () => window.open(url, '_blank', 'noopener,noreferrer');
    card.onkeypress = (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        window.open(url, '_blank', 'noopener,noreferrer');
      }
    };
  }
  
  card.innerHTML = `
    ${type ? `<span class="resource-type ${type.toLowerCase()}">${type.charAt(0).toUpperCase() + type.slice(1)}</span>` : ''}
    <strong>${name}</strong>
    ${description ? `<p>${description}</p>` : ''}
    ${url ? `<span class="resource-link-indicator">↗</span>` : ''}
  `;
  
  return card;
}

// Enhanced crisis data loading with new structures
async function loadCrisisData() {
  try {
    const response = await fetch('data/crisis.json');
    if (!response.ok) throw new Error(`Failed to load crisis data: ${response.status}`);
    
    crisisData = await response.json();
    console.log('✅ Crisis data loaded:', {
      resources: crisisData.resources?.length || 0,
      categories: crisisData.resourceCategories?.length || 0,
      guides: crisisData.quickAccessGuides?.length || 0
    });
    
    // Initialize crisis UI components
    initCrisisSection();
    return crisisData;
  } catch (error) {
    console.error('❌ Error loading crisis data:', error);
    displayCrisisError(error.message);
  }
}

// Build the main crisis section with all components
function initCrisisSection() {
  if (!crisisData) return;
  
  const crisisSection = document.getElementById('crisis-section');
  if (!crisisSection) return;
  
  let html = '';
  
  // Add introduction
  if (crisisData.introduction) {
    html += crisisData.introduction;
  }
  
  // Add crisis category tabs
  html += renderCrisisCategoryNav();
  
  // Add resource filtering UI
  html += renderCrisisFilterUI();
  
  // Add resources container (will be populated by filtering)
  html += '<div id="crisis-resources-container" class="crisis-resources"></div>';
  
  // Add quick access guides section
  html += renderQuickAccessGuidesSection();
  
  // Add detailed guide
  if (crisisData.detailedGuide) {
    html += crisisData.detailedGuide;
  }
  
  crisisSection.innerHTML = html;
  
  // Attach event listeners
  attachCrisisEventListeners();
  
  // Load initial resource view (all resources)
  displayResourcesByCategory('all');
}

// Render category navigation tabs

function renderCrisisCategoryNav() {
  if (!crisisData.resourceCategories || !crisisData.resources) return '';
  
  // Calculate total resource count
  const totalResources = crisisData.resources.length;

  let html = '<div class="crisis-category-nav"><div class="category-tabs">';
  
  // Manually prepend the "All Resources" tab
  html += `
    <button class="category-tab active" 
            data-category="all" 
            style="--accent-color: var(--color-primary)">
      <span class="tab-icon">${getIconElement('all')}</span>
      <span class="tab-label">All Resources</span>
      <span class="tab-count">${totalResources}</span>
    </button>
  `;

  crisisData.resourceCategories.forEach(category => {
    html += `
      <button class="category-tab" 
              data-category="${category.id}" 
              style="--accent-color: var(--color-${getCategoryColor(category.color_accent)})">
        <span class="tab-icon">${getIconElement(category.icon)}</span>
        <span class="tab-label">${category.name}</span>
        <span class="tab-count">${category.resource_count}</span>
      </button>
    `;
  });
  
  html += '</div></div>';
  return html;
}

// Render crisis filtering UI
function renderCrisisFilterUI() {
  if (!crisisData.resourceFilters?.filters) return '';

  // Get the filter definitions from JSON
  const filters = crisisData.resourceFilters.filters;
  const situationFilter = filters.find(f => f.name === 'situation');
  const providerFilter = filters.find(f => f.name === 'provider_type');
  const accessFilter = filters.find(f => f.name === 'access_method');

  // Helper to create <option> tags
  const createOptions = (filter, defaultLabel) => {
    if (!filter) return '';
    let optionsHtml = `<option value="all">${defaultLabel}</option>`;
    optionsHtml += filter.options.map(option => 
      `<option value="${option}">${formatFilterLabel(option)}</option>`
    ).join('');
    return optionsHtml;
  };

  const html = `
    <div class="crisis-filters">
      <div class="filter-controls" style="grid-template-columns: 1fr 1fr 1fr; gap: 16px;">
        
        <div class="filter-group">
          <label for="filter-situation">${situationFilter.label}</label>
          <select id="filter-situation" class="form-control" data-filter="situation">
            ${createOptions(situationFilter, 'All Situations')}
          </select>
        </div>
        
        <div class="filter-group">
          <label for="filter-provider_type">${providerFilter.label}</label>
          <select id="filter-provider_type" class="form-control" data-filter="provider_type">
            ${createOptions(providerFilter, 'All Roles')}
          </select>
        </div>

        <div class="filter-group">
          <label for="filter-access_method">${accessFilter.label}</label>
          <select id="filter-access_method" class="form-control" data-filter="access_method">
            ${createOptions(accessFilter, 'All Methods')}
          </select>
        </div>
        
      </div>
      <button class="filter-reset" style="margin-top: 16px;">Clear Filters</button>
    </div>
  `;
  
  return html;
}

// Render quick access guides section
function renderQuickAccessGuidesSection() {
  if (!crisisData.quickAccessGuides) return '';
  
  let html = '<div class="quick-access-section"><h3>Crisis Guides by Situation</h3><div class="guides-container">';
  
  crisisData.quickAccessGuides.forEach(guide => {
    const urgencyClass = guide.urgency.toLowerCase();
    html += `
      <div class="guide-card urgency-${urgencyClass}" data-guide="${guide.id}">
        <div class="guide-header">
          <h4>${guide.title}</h4>
          <span class="urgency-badge ${urgencyClass}">${guide.urgency}</span>
        </div>
        <div class="guide-preview">
          <strong>Steps:</strong> ${guide.steps.length} actions to take
        </div>
        <button class="expand-guide" data-guide="${guide.id}">View Guide</button>
      </div>
    `;
  });
  
  html += '</div></div>';
  return html;
}

// Display resources filtered by category
function displayResourcesByCategory(categoryId) {
  if (!crisisData?.resources) return;
  
  let filtered = [];
  
  if (categoryId === 'all') {
    filtered = [...crisisData.resources];
  } else {
    filtered = crisisData.resources.filter(r => r.category_id === categoryId);
  }
  
  renderCrisisResourceCards(filtered, categoryId);
  
  // Update active tab
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.category === categoryId);
  });
}

// Display resources filtered by provider type
function filterCrisisResourcesByProvider(providerType) {
  if (!crisisData?.resources) return;
  
  let filtered = crisisData.resources;
  
  if (providerType && providerType !== 'any') {
    filtered = filtered.filter(r => 
      r.specialties?.includes(providerType)
    );
  }
  
  renderCrisisResourceCards(filtered, 'provider_' + providerType);
  
  // Update filter UI
  document.querySelectorAll('[data-filter="provider_type"]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === providerType);
  });
}

// Display resources filtered by access method
function filterCrisisResourcesByAccessMethod(accessMethod) {
  if (!crisisData?.resources) return;
  
  let filtered = crisisData.resources;
  
  if (accessMethod) {
    filtered = filtered.filter(r =>
      r.access_methods?.includes(accessMethod)
    );
  }
  
  renderCrisisResourceCards(filtered, 'access_' + accessMethod);
  
  // Update filter UI
  document.querySelectorAll('[data-filter="access_method"]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === accessMethod);
  });
}

// Apply multiple filters
function applyCrisisFilters() {
  // Read values directly from the <select> dropdowns
  const activeFilters = {
    situation: document.getElementById('filter-situation')?.value,
    provider_type: document.getElementById('filter-provider_type')?.value,
    access_method: document.getElementById('filter-access_method')?.value,
  };
  
  let filtered = [...(crisisData?.resources || [])];
  
  // Apply each filter
  if (activeFilters.situation && activeFilters.situation !== 'all') {
    filtered = filtered.filter(r => r.situation?.includes(activeFilters.situation));
  }
  
  if (activeFilters.provider_type && activeFilters.provider_type !== 'all') {
    filtered = filtered.filter(r => r.specialties?.includes(activeFilters.provider_type));
  }
  
  if (activeFilters.access_method && activeFilters.access_method !== 'all') {
    filtered = filtered.filter(r => r.access_methods?.includes(activeFilters.access_method));
  }
  
  // Get the currently active CATEGORY TAB (e.g., "Primary Emergency")
  const activeCategory = document.querySelector('.category-tab.active')?.dataset.category;
  
  // First, filter by the active tab (unless it's "all")
  if (activeCategory && activeCategory !== 'all') {
      filtered = filtered.filter(r => r.category_id === activeCategory);
  }

  // Then, apply the dropdown filters
  renderCrisisResourceCards(filtered, 'filtered');
}

// Render crisis resource cards with all metadata
function renderCrisisResourceCards(resources, containerId = 'default') {
  const container = document.getElementById('crisis-resources-container');
  if (!container) return;
  
  if (resources.length === 0) {
    container.innerHTML = `
      <div class="no-results">
        <p>No resources match your filters.</p>
        <button class="btn-secondary" onclick="clearCrisisFilters()">Clear Filters</button>
      </div>
    `;
    return;
  }
  
  let html = '<div class="crisis-cards-grid">';
  
  resources.forEach(resource => {
    const contactInfo = buildContactInfo(resource);
    const metadata = buildResourceMetadata(resource);
    const specialties = (resource.specialties && resource.specialties.length > 0)
                          ? resource.specialties.map(spec => crisisData.providerTypeMap[spec] || spec).join(', ')
                          : (crisisData.providerTypeMap['any'] || 'All Providers');

    html += `
      <div class="crisis-card ${resource.type}" data-resource="${resource.id}">
        
        <div class="card-header">
          <span class="resource-type-badge">${resource.type}</span>
          <div class="card-title-row">
            <h3>${resource.name}</h3>
          </div>
          ${resource.best_for ? `
            <div class="card-best-for">
              <strong>Best for:</strong> ${resource.best_for}
            </div>
          ` : ''}
        </div>
        
        <div class="card-contact">
          ${contactInfo} 
        </div>
        
        <details class="card-details-toggle">
          <summary>View Details</summary>
          <div class="card-details-content">
            <div class="card-metadata">
              ${metadata}
            </div>
            <div class="card-specialties">
              <strong>For:</strong> ${specialties}
            </div>
            <p class="card-description" style="margin-bottom: 0;">${resource.description}</p>
          </div>
        </details>

      </div> `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Build contact information display
function buildContactInfo(resource) {
  let html = '';
  
  if (resource.contact_methods?.includes('phone') && resource.phone) {
    html += `<div class="contact-method">
      <strong>Call:</strong>
      <a href="tel:${resource.phone}" class="contact-link">${resource.phone}</a>
    </div>`;
  }
  
  if (resource.contact_methods?.includes('text')) {
    if (resource.text_code) {
      html += `<div class="contact-method">
        <strong>Text:</strong>
        <strong class="text-keyword">${resource.text_code}</strong> to 
        <a href="sms:${resource.text_number}" class="contact-link">${resource.text_number}</a>
      </div>`;
    }
  }
  
  if (resource.contact_methods?.includes('chat')) {
    html += `<div class="contact-method">
      <strong>Chat:</strong> Available online
    </div>`;
  }
  
  if (resource.web_url) {
    const marginTop = (html !== '') ? 'margin-top: 16px;' : '';
    html += `<a href="${resource.web_url}" target="_blank" class="btn-primary" style="width: 100%; text-decoration: none; ${marginTop}">Visit Site</a>`;
  }
  
  return html;
}

// Build resource metadata display
function buildResourceMetadata(resource) {
  let html = '<div class="metadata-grid">';
  
  if (resource.availability) {
    html += `
      <div class="metadata-item">
        <span class="metadata-label">Availability:</span>
        <span class="metadata-value">${resource.availability}</span>
      </div>
    `;
  }
  
  if (resource.response_time) {
    html += `
      <div class="metadata-item">
        <span class="metadata-label">Response:</span>
        <span class="metadata-value">${resource.response_time}</span>
      </div>
    `;
  }
  
  if (resource.confidentiality_level) {
    html += `
      <div class="metadata-item">
        <span class="metadata-label">Confidentiality:</span>
        <span class="metadata-value">${formatLabel(resource.confidentiality_level)}</span>
      </div>
    `;
  }
  
  if (resource.languages?.length) {
    html += `
      <div class="metadata-item">
        <span class="metadata-label">Languages:</span>
        <span class="metadata-value">${resource.languages.slice(0, 3).join(', ')}${resource.languages.length > 3 ? '+' : ''}</span>
      </div>
    `;
  }
  
  html += '</div>';
  return html;
}

// Render detailed step-by-step guides
function renderQuickAccessGuides(guideId) {
  if (!crisisData?.quickAccessGuides) return;
  
  const guide = crisisData.quickAccessGuides.find(g => g.id === guideId);
  if (!guide) return;
  
  const modal = document.createElement('div');
  modal.className = 'guide-modal';
  modal.innerHTML = `
    <div class="guide-modal-content">
      <button class="modal-close" onclick="this.closest('.guide-modal').remove()">×</button>
      
      <div class="guide-header">
        <h2>${guide.title}</h2>
        <span class="urgency-badge ${guide.urgency.toLowerCase()}">${guide.urgency}</span>
      </div>
      
      <div class="guide-steps">
        ${guide.steps.map((step, idx) => `
          <div class="step">
            <div class="step-number">${step.step}</div>
            <div class="step-content">
              <h4>${step.action}</h4>
              <p>${step.description}</p>
              ${step.resources?.length ? `
                <div class="step-resources">
                  <strong>Resources:</strong>
                  ${step.resources.map(rid => {
                    const resource = crisisData.resources.find(r => r.id === rid);
                    return resource ? `<span class="resource-tag">${resource.name}</span>` : '';
                  }).join('')}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
      
      ${guide.do_and_dont ? `
        <div class="do-and-dont">
          <div class="do-column">
            <h4>✅ Do:</h4>
            <ul>
              ${guide.do_and_dont.do.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
          <div class="dont-column">
            <h4>❌ Don't:</h4>
            <ul>
              ${guide.do_and_dont.dont.map(item => `<li>${item}</li>`).join('')}
            </ul>
          </div>
        </div>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Render provider-specific guide
function renderProviderSpecificGuide(providerType) {
  if (!crisisData?.supportedProviderGuides) return;
  
  const guide = crisisData.supportedProviderGuides.find(g => g.provider_type === providerType);
  if (!guide) return;
  
  const guideSection = document.createElement('div');
  guideSection.className = 'provider-guide-section';
  guideSection.innerHTML = `
    <div class="provider-guide">
      <h3>${guide.title}</h3>
      
      <div class="guide-content">
        <div class="challenges">
          <h4>Unique Challenges for ${formatLabel(providerType)}:</h4>
          <ul>
            ${guide.key_challenges.map(c => `<li>${c}</li>`).join('')}
          </ul>
        </div>
        
        <div class="recommended-resources">
          <h4>Recommended Resources:</h4>
          <div class="resource-list">
            ${guide.recommended_resources.map(rid => {
              const resource = crisisData.resources.find(r => r.id === rid);
              return resource ? `
                <div class="recommended-resource">
                  <strong>${resource.name}</strong>
                  <p>${resource.description}</p>
                </div>
              ` : '';
            }).join('')}
          </div>
        </div>
        
        <div class="guidance">
          <h4>Provider-Specific Guidance:</h4>
          <p>${guide.specific_guidance}</p>
        </div>
      </div>
    </div>
  `;
  
  return guideSection;
}

// Display crisis indicators by severity level
function renderCrisisIndicators() {
  if (!crisisData?.crisisIndicators) return '';
  
  const indicators = crisisData.crisisIndicators;
  let html = '<div class="crisis-indicators-section"><h3>Recognize Crisis by Severity</h3>';
  
  ['critical', 'high', 'moderate'].forEach(level => {
    const indicator = indicators[level];
    html += `
      <div class="indicator-level level-${level}">
        <div class="level-header">
          <h4>${indicator.level}</h4>
          <span class="level-color" style="background: var(--color-${indicator.color})"></span>
        </div>
        
        <div class="signs-list">
          <strong>Warning Signs:</strong>
          <ul>
            ${indicator.signs.map(sign => `<li>${sign}</li>`).join('')}
          </ul>
        </div>
        
        <div class="action">
          <strong>What to Do:</strong>
          <p>${indicator.immediate_action}</p>
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  return html;
}

// Initialize all crisis filter UI interactions
function initCrisisFilters() {
  // Category tabs (This logic stays the same)
  document.querySelectorAll('.category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      // Set the active tab
      document.querySelectorAll('.category-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      // Clear dropdowns and apply filters (which will now just filter by tab)
      clearCrisisFilters(false); // false = don't reset the tab
    });
  });
  
  // Filter dropdowns
  document.querySelectorAll('.crisis-filters select').forEach(select => {
    select.addEventListener('change', () => {
      applyCrisisFilters();
    });
  });
  
  // Guide expand buttons (This logic stays the same)
  document.querySelectorAll('.expand-guide').forEach(btn => {
    btn.addEventListener('click', () => {
      renderQuickAccessGuides(btn.dataset.guide);
    });
  });
  
  // Reset filters button
  document.querySelector('.filter-reset')?.addEventListener('click', () => {
    clearCrisisFilters(true); // true = reset everything, including tab
  });
}

function attachCrisisEventListeners() {
  initCrisisFilters();
}

function clearCrisisFilters(resetTab = true) {
  // Reset dropdowns to their first option ("all")
  const situationFilter = document.getElementById('filter-situation');
  if (situationFilter) situationFilter.value = 'all';

  const providerTypeFilter = document.getElementById('filter-provider_type');
  if (providerTypeFilter) providerTypeFilter.value = 'all';

  const accessMethodFilter = document.getElementById('filter-access_method');
  if (accessMethodFilter) accessMethodFilter.value = 'all';

  if (resetTab) {
    // Set "All Resources" as the default active tab
    document.querySelectorAll('.category-tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.category === 'all');
    });
    // Display all resources
    displayResourcesByCategory('all');
  } else {
    // Just re-run the filters based on the currently active tab
    applyCrisisFilters();
  }
}

// Track when a resource is accessed
function handleCrisisResourceSelection(resourceId) {
  const resource = crisisData?.resources?.find(r => r.id === resourceId);
  if (!resource) return;
  
  // Log analytics event (implement based on your analytics provider)
  logAnalytics('crisis_resource_accessed', {
    resource_id: resourceId,
    resource_name: resource.name,
    resource_category: resource.category_id,
    timestamp: new Date().toISOString()
  });
  
  // Show expanded resource modal
  const modal = document.createElement('div');
  modal.className = 'resource-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <button class="modal-close" onclick="this.closest('.resource-modal').remove()">×</button>
      
      <div class="resource-detail">
        <h2>${resource.name}</h2>
        <p class="description-expanded">${resource.description_expanded}</p>
        
        <div class="resource-actions">
          ${resource.phone ? `<a href="tel:${resource.phone}" class="btn-primary btn-large">Call Now</a>` : ''}
          ${resource.text_number ? `<a href="sms:${resource.text_number}" class="btn-primary btn-large">Text Now</a>` : ''}
          ${resource.web_url ? `<a href="${resource.web_url}" target="_blank" class="btn-secondary">Visit Website</a>` : ''}
        </div>
        
        <button class="btn-secondary" onclick="shareResourceWithColleague('${resourceId}')">
          Share with Colleague
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

// Share resource via link/card
function shareResourceWithColleague(resourceId) {
  const resource = crisisData?.resources?.find(r => r.id === resourceId);
  if (!resource) return;
  
  const shareUrl = `${window.location.origin}?crisis_resource=${resourceId}`;
  const shareText = `Check out this crisis resource: ${resource.name} - ${resource.description}`;
  
  if (navigator.share) {
    navigator.share({
      title: resource.name,
      text: shareText,
      url: shareUrl
    });
  } else {
    // Fallback: copy to clipboard
    const textToCopy = `${resource.name}\n${resource.description}\n${shareUrl}`;
    navigator.clipboard.writeText(textToCopy).then(() => {
      alert('Resource information copied to clipboard!');
    });
  }
  
  logAnalytics('crisis_resource_shared', {
    resource_id: resourceId,
    resource_name: resource.name
  });
}

// Get icon element by icon name
function getIconElement(iconName) {
  const iconMap = {
	'all': '🗂️',
    'alert-circle': '🚨',
    'stethoscope': '🩺',
    'map-pin': '📍',
    'users': '👥',
    'briefcase': '💼',
    'phone': '☎️',
    'message-square': '💬',
    'heart': '❤️',
    'alert': '⚠️',
    'user-md': '👨‍⚕️',
    'heart-handshake': '🤝',
    'shield-check': '✅',
    'users-check': '✓',
    'clock': '🕐',
    'phone-alert': '📞',
    'circle-users': '⭕👥',
    'shield-heart': '💙',
    'globe': '🌐',
    'briefcase-medical': '🏥',
    'cross': '✝️',
    'activity': '📊',
    'phone-help': '📞💁'
  };
  return iconMap[iconName] || '•';
}

// Format label from data value
function formatLabel(value) {
  return value.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Format filter label
function formatFilterLabel(value) {
  return value.split('_').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
}

// Extract domain from URL
function extractDomain(url) {
  try {
    const domain = new URL(url).hostname.replace('www.', '');
    return domain;
  } catch {
    return url;
  }
}

// Get category color from name
function getCategoryColor(colorName) {
  const colorMap = {
    'red': 'red-500',
    'teal': 'teal-500',
    'orange': 'orange-500',
    'green': 'teal-500',
    'blue': 'teal-300'
  };
  return colorMap[colorName] || 'teal-500';
}

// Display error if crisis data fails to load
function displayCrisisError(errorMessage) {
  const crisisSection = document.getElementById('crisis-section');
  if (crisisSection) {
    crisisSection.innerHTML = `
      <div class="crisis-error">
        <h3>Crisis Resources Temporarily Unavailable</h3>
        <p>We're having trouble loading the full resource list, but help is always available:</p>
        <div class="fallback-resources">
          <a href="tel:988" class="btn-primary">Call 988</a>
          <a href="sms:741741?body=FRONTLINE" class="btn-primary">Text FRONTLINE to 741741</a>
        </div>
        <p class="error-detail">Error: ${errorMessage}</p>
      </div>
    `;
  }
}

/**
 * Global state management for organization features
 */
const OrgState = {
    currentData: null,
    selectedCategory: null,
    selectedStrategies: [],
    filterCriteria: {
        providerType: 'all',
        timeline: 'all',
        cost: 'all',
        difficulty: 'all',
        quickWinOnly: false
    },
    comparisonMode: false
};

/**
 * Load expanded organization data with error handling
 * @returns {Promise<Object>} Organization data object
 */
async function loadOrganizationData() {
    try {
        const response = await fetch('data/organization.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        console.log('✅ Organization data loaded:', data.metadata);
        return data;
    } catch (error) {
        console.error('❌ Error loading organization data:', error);
        document.getElementById('organizational').innerHTML = `<p class="crisis-error">Error loading organizational strategies: ${error.message}</p>`;
        return {
            title: "Organizational Strategies",
            categories: [],
            error: true,
            errorMessage: error.message
        };
    }
}

/*Helper function to attach event listeners to accordions*/
function attachAccordionListeners(selector) {
    document.querySelectorAll(selector).forEach(header => {
        // Prevent duplicate listeners
        if (header.dataset.listenerAttached) return;
        
        header.addEventListener('click', () => {
            const contentId = header.dataset.toggle;
            const content = document.getElementById(contentId);
            const icon = header.querySelector('.exec-toggle-icon');

            if (content && icon) {
                content.classList.toggle('is-collapsed');
                const isCollapsed = content.classList.contains('is-collapsed');
                icon.style.transform = isCollapsed ? 'rotate(0deg)' : 'rotate(180deg)';
            }
        });
        header.dataset.listenerAttached = 'true';
    });
}

/**
 * Render Executive Summary for C-Suite
 * @param {Object} data - Organization data
 */
function renderExecutiveSummary(data, containerId = 'executive-summary-container') {
    const container = document.getElementById(containerId);
    if (!container || !data.executive_summary) return;

    const summary = data.executive_summary;

    const html = `
        <section class="executive-summary">
            <div class="exec-header">
                <h3>${summary.title}</h3>
                <button class="export-btn btn btn--secondary" onclick="exportExecutiveSummary()">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                    Export as HTML
                </button>
            </div>

            ${summary.introduction ? `<p class="exec-intro">${summary.introduction}</p>` : ''}

            ${summary.key_metrics ? `
                <div class="exec-metrics-grid">
                    ${summary.key_metrics.map(metric => `
                        <div class="exec-metric-card">
                            <div class="metric-value">${metric.value}</div>
                            <div class="metric-label">${metric.label}</div>
                            <div class="metric-detail">${metric.detail}</div>
                            <div class="metric-source">Source: ${metric.source}</div>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${summary.critical_actions ? `
                <div class="critical-actions-section">
                    <h4>Critical Actions</h4>
                    <div class="exec-accordion">
                        ${summary.critical_actions.map((item, index) => `
                            <div class="exec-accordion-item">
                                <div class="exec-item-header" data-toggle="exec-action-${index}">
                                    <span class="exec-item-title">${item.action}</span>
                                    <svg class="exec-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                <div class="exec-item-content is-collapsed" id="exec-action-${index}">
                                    <p class="exec-item-summary">${item.summary}</p>
                                    <div class="exec-item-details">${item.details_expanded}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}

            ${summary.strategic_alignment ? `
                <div class="strategic-alignment-section">
                    <h4>Strategic Alignment</h4>
                    <div class="exec-accordion">
                        ${summary.strategic_alignment.map((item, index) => `
                            <div class="exec-accordion-item">
                                <div class="exec-item-header" data-toggle="exec-align-${index}">
                                    <span class="exec-item-title">${item.objective}</span>
                                    <svg class="exec-toggle-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                </div>
                                <div class="exec-item-content is-collapsed" id="exec-align-${index}">
                                    <p class="exec-item-summary">${item.summary}</p>
                                    <div class="exec-item-details">${item.details_expanded}</div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            ` : ''}
            
            ${summary.timeline_overview ? `
                <div class="timeline-summary">
                    <h5>Implementation Timeline</h5>
                    <p class="timeline-text">${summary.timeline_overview}</p>
                </div>
            ` : ''}
        </section>
    `;

    container.innerHTML = html;

    // Attach event listeners for new accordions
    attachAccordionListeners('.exec-item-header');
}

/**
 * Render Implementation Roadmap with interactive timeline
 * @param {Object} data - Organization data
 */
function renderImplementationRoadmap(data, containerId = 'roadmap-container') {
    const container = document.getElementById(containerId);
    // Corrected path to match organization.json
    if (!container || !data.implementation_roadmap || !Array.isArray(data.implementation_roadmap.phases)) return;

    const { phases } = data.implementation_roadmap;

    const html = `
        <section class="implementation-roadmap">
            <div class="roadmap-header">
                <h3>${data.implementation_roadmap.title}</h3>
                <p class="roadmap-description">${data.implementation_roadmap.description}</p>
            </div>

            <div class="roadmap-timeline">
                ${phases.map((phase, idx) => `
                    <div class="roadmap-phase" data-phase="${idx}">
                        <div class="phase-header" onclick="togglePhaseDetails(${idx})">
                            <div class="phase-number">${idx + 1}</div>
                            <div class="phase-info">
                                <h4 class="phase-title">${phase.phase}</h4>
                                <p class="phase-goal">${phase.goal}</p>
                            </div>
                            <div class="phase-toggle">▼</div>
                        </div>

                        <div class="phase-details" id="phase-details-${idx}" style="display: none;">
                            <div class="strategies-timeline">
                                ${phase.strategies.map((strategy, sidx) => `
                                    <div class="timeline-strategy" data-strategy="${sidx}">
                                        <div class="strategy-timeline-header">
                                            <span class="strategy-name">${strategy.strategy}</span>
                                            <span class="strategy-timeline-badge">${strategy.timeline}</span>
                                        </div>
                                        <div class="strategy-outcome">${strategy.expected_outcome}</div>
                                        <div class="strategy-metrics">
                                            <span class="cost-badge">${strategy.cost}</span>
                                            <span class="roi-badge">ROI: ${strategy.roi_timeline}</span>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>

                            <div class="phase-metrics">
                                <h5>Success Metrics</h5>
                                <ul class="metrics-list">
                                    ${phase.metrics.map(metric => `
                                        <li class="metric-item">${metric}</li>
                                    `).join('')}
                                </ul>
                            </div>
                        </div>
                    </div>
                `).join('')}
            </div>
            
            <!-- Removed 'Customize Timeline' button as function is not defined -->
            <div class="roadmap-actions">
                <button class="btn-primary" onclick="exportRoadmap()">Export Roadmap</button>
            </div>
        </section>
    `;

    container.innerHTML = html;
}

/**
 * Toggle phase details in roadmap
 */
function togglePhaseDetails(phaseIdx) {
    const details = document.getElementById(`phase-details-${phaseIdx}`);
    const toggle = document.querySelector(`[data-phase="${phaseIdx}"] .phase-toggle`);
    
    if (details.style.display === 'none') {
        details.style.display = 'block';
        toggle.textContent = '▲';
    } else {
        details.style.display = 'none';
        toggle.textContent = '▼';
    }
}

/**
 * Render Provider Role-Specific Strategies
 * @param {Object} data - Organization data
 */
function renderProviderRoleStrategies(data, containerId = 'provider-role-container') {
    const container = document.getElementById(containerId);
    // Corrected path to match organization.json
    if (!container || !data.provider_role_strategies) {
         console.warn("provider_role_strategies data not found in organization.json");
         return;
    }

    const roles = data.provider_role_strategies;

    const html = `
        <section class="provider-role-strategies">
            <div class="role-header">
                <h3>Provider Role-Specific Organizational Strategies</h3>
                <p>Tailored approaches for different healthcare provider types</p>
            </div>

            <div class="role-selector">
                <label for="role-filter">Select Provider Type:</label>
                <select id="role-filter" onchange="filterByProviderRole(this.value)">
                    <option value="all">All Provider Types</option>
                    ${Object.keys(roles).map(role => `
                        <option value="${role}">${role}</option>
                    `).join('')}
                </select>
            </div>

            <div id="role-strategies-display" class="role-strategies-container">
                ${Object.entries(roles).map(([role, strategies]) => `
                    <div class="role-strategy-card" data-role="${role}">
                        <h4 class="role-name">${role}</h4>
                        <div class="role-pain-points">
                            <h5>Key Pain Points</h5>
                            <ul>
                                ${strategies.pain_points.map(point => `
                                    <li>${point}</li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="role-recommended-strategies">
                            <h5>Recommended Strategies</h5>
                            <ul>
                                ${strategies.recommended_strategies.map(strat => `
                                    <li class="recommended-strategy">
                                        <strong>${strat.strategy}</strong>: ${strat.rationale}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                        <div class="role-metrics">
                            <h5>Success Metrics</h5>
                            <ul class="metrics-tags">
                                ${strategies.success_metrics.map(metric => `
                                    <li class="metric-tag">${metric}</li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                `).join('')}
            </div>
        </section>
    `;

    container.innerHTML = html;
}

/**
 * Filter strategies by provider role
 */
function filterByProviderRole(role) {
    const cards = document.querySelectorAll('.role-strategy-card');
    cards.forEach(card => {
        if (role === 'all' || card.dataset.role === role) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

function renderStrategyCategories(data, containerId = 'categories-container') {
    const container = document.getElementById(containerId);
    if (!container || !data.categories) return;

    let html = '<h3>All Organizational Strategies</h3>';
    data.categories.forEach(category => {
        html += `
            <div class="org-category">
                <div class="org-category-header" data-toggle="${category.id}">
                    <div class="org-category-title">
                        <h3>${category.name}</h3>
                    </div>
                    <svg class="toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
                        <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                </div>
                <div id="${category.id}" class="org-category-content is-collapsed">
                    <p class="category-intro">${category.introduction || ''}</p>
                    <ul class="strategy-list">
                        ${category.strategies.map(strategy => `
                            <li class="strategy-item" data-strategy-id="${strategy.id}">
                                <strong>${strategy.title}</strong>
                                <p>${strategy.description}</p>
                                <div class="strategy-metrics">
                                    <span class="cost-badge">${strategy.implementation.estimated_cost}</span>
                                    <span class="strategy-timeline-badge">${strategy.implementation.timeline}</span>
                                    <span class="roi-badge">${strategy.evidence_level} Evidence</span>
                                </div>
                                <!-- Add to compare button -->
                                <button class="btn btn--secondary btn--sm" onclick="handleAddToComparison('${strategy.id}')">Add to Compare</button>
                            </li>
                        `).join('')}
                    </ul>
                </div>
            </div>
        `;
    });
    container.innerHTML = html;

    // Attach event listeners for these new accordions
    const orgHeaders = document.querySelectorAll('.org-category-header');
    orgHeaders.forEach(header => {
      header.addEventListener('click', () => {
        const toggleId = header.dataset.toggle;
        const content = document.getElementById(toggleId);
        
        header.classList.toggle('active');
        content.classList.toggle('is-collapsed');
      });
    });
}

/**
 * Strategy comparison tool - select 2-3 strategies for side-by-side comparison
 */
function initializeStrategyComparison() {
    OrgState.comparisonMode = true;
    
    // Check if panel exists, if not, create it
    let comparisonPanel = document.getElementById('comparison-panel');
    if (!comparisonPanel) {
        comparisonPanel = document.createElement('div');
        comparisonPanel.id = 'comparison-panel';
        comparisonPanel.className = 'comparison-panel';
        document.body.appendChild(comparisonPanel);
    }
    
    comparisonPanel.innerHTML = `
        <div class="comparison-header">
            <h3>Strategy Comparison</h3>
            <button onclick="closeComparison()">✕</button>
        </div>
        <div class="comparison-instructions">
            Select 2-3 strategies to compare side-by-side
        </div>
        <div id="comparison-grid" class="comparison-grid"></div>
        <div class="comparison-actions">
            <button class="btn-primary" onclick="exportComparison()">Export Comparison</button>
            <button class="btn-secondary" onclick="clearComparison()">Clear Selection</button>
        </div>
    `;
    
    updateComparisonGrid(); // Render with current selection (or empty)
}

/**
 * Handler function to find strategy by ID and add to comparison
 */
function handleAddToComparison(strategyId) {
    const strategy = findStrategyById(strategyId);
    if (!strategy) {
        console.error("Could not find strategy to compare:", strategyId);
        return;
    }

    if (!OrgState.comparisonMode) {
        initializeStrategyComparison();
    }
    
    addToComparison(strategy);
}


/**
 * Add strategy to comparison
 * @param {Object} strategy - Strategy object to compare
 */
function addToComparison(strategy) {
    if (OrgState.selectedStrategies.find(s => s.id === strategy.id)) {
        alert("Strategy is already in the comparison list.");
        return;
    }

    if (OrgState.selectedStrategies.length >= 3) {
        alert('Maximum 3 strategies can be compared at once');
        return;
    }
    
    OrgState.selectedStrategies.push(strategy);
    updateComparisonGrid();
}

/**
 * Update comparison grid display
 */
function updateComparisonGrid() {
    const grid = document.getElementById('comparison-grid');
    if (!grid) return;
    
    const strategies = OrgState.selectedStrategies;
    
    if (strategies.length === 0) {
        grid.innerHTML = '<p class="no-selection">No strategies selected</p>';
        return;
    }
    
    const comparisonFields = [
        { key: 'title', label: 'Strategy Name' },
        { key: 'implementation.timeline', label: 'Timeline' },
        { key: 'implementation.estimated_cost', label: 'Estimated Cost' },
        { key: 'implementation.difficulty', label: 'Difficulty' },
        { key: 'roi', label: 'Expected ROI' },
        { key: 'quick_win', label: 'Quick Win?' },
        { key: 'evidence_level', label: 'Evidence Level' }
    ];
    
    const html = `
        <table class="comparison-table">
            <thead>
                <tr>
                    <th>Criteria</th>
                    ${strategies.map((s, idx) => `
                        <th>
                            Strategy ${idx + 1}
                            <button class="remove-strategy" onclick="removeFromComparison(${idx})">✕</button>
                        </th>
                    `).join('')}
                </tr>
            </thead>
            <tbody>
                ${comparisonFields.map(field => `
                    <tr>
                        <td class="criteria-label">${field.label}</td>
                        ${strategies.map(strategy => {
                            // Use corrected getNestedValue function
                            const value = getNestedValue(strategy, field.key);
                            return `<td>${formatComparisonValue(value, field.key)}</td>`;
                        }).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    
    grid.innerHTML = html;
}

/**
 * Get nested object value using dot notation
 */
function getNestedValue(obj, path) {
    // Corrected: handle path gracefully
    return path.split('.').reduce((current, key) => (current && current[key] !== undefined) ? current[key] : null, obj);
}

/**
 * Format comparison value for display
 */
function formatComparisonValue(value, key) {
    if (value === undefined || value === null) return 'N/A';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value;
}

/**
 * Remove strategy from comparison
 */
function removeFromComparison(idx) {
    OrgState.selectedStrategies.splice(idx, 1);
    updateComparisonGrid();
}

/**
 * Close comparison panel
 */
function closeComparison() {
    OrgState.comparisonMode = false;
    OrgState.selectedStrategies = [];
    const panel = document.getElementById('comparison-panel');
    if (panel) panel.remove();
}

/**
 * Clear comparison selection
 */
function clearComparison() {
    OrgState.selectedStrategies = [];
    updateComparisonGrid();
}


/**
 * Apply multi-criteria filter to strategies
 * @param {Object} criteria - Filter criteria object
 */
function applyStrategyFilters(criteria) {
    OrgState.filterCriteria = { ...OrgState.filterCriteria, ...criteria };
    
    const allStrategies = document.querySelectorAll('.strategy-item');
    
    allStrategies.forEach(strategyEl => {
        const strategyId = strategyEl.dataset.strategyId;
        const strategy = findStrategyById(strategyId);
        
        if (!strategy) {
            strategyEl.style.display = 'none';
            return;
        }
        
        const passes = checkStrategyAgainstFilters(strategy, OrgState.filterCriteria);
        strategyEl.style.display = passes ? 'block' : 'none';
    });
}

/**
 * Check if strategy passes all filter criteria
 */
function checkStrategyAgainstFilters(strategy, filters) {
    // Use corrected getNestedValue to safely access deep properties
    if (filters.timeline !== 'all') {
        const timeline = getNestedValue(strategy, 'implementation.timeline') || '';
        if (filters.timeline === 'quick_win' && !strategy.quick_win) return false;
        if (filters.timeline === 'short' && !timeline.includes('months') && !timeline.includes('weeks')) return false;
        if (filters.timeline === 'long' && !timeline.includes('year')) return false;
    }
    
    if (filters.cost !== 'all') {
        const cost = (getNestedValue(strategy, 'implementation.estimated_cost') || '').toLowerCase();
        if (filters.cost === 'low' && !(cost.includes('k') || cost.includes('time'))) return false;
        if (filters.cost === 'medium' && !(cost.includes('100k') || cost.includes('250k'))) return false;
        if (filters.cost === 'high' && !(cost.includes('500k') || cost.includes('m'))) return false;
    }
    
    if (filters.difficulty !== 'all') {
        if (getNestedValue(strategy, 'implementation.difficulty') !== filters.difficulty) return false;
    }
    
    if (filters.quickWinOnly && !strategy.quick_win) {
        return false;
    }
    
    return true;
}

/**
 * Full-text search across organization content
 * @param {string} query - Search query
 */
function searchOrganizationContent(query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;

    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        return;
    }
    
    const normalizedQuery = query.toLowerCase().trim();
    const searchWords = normalizedQuery.split(/\s+/).filter(w => w.length > 0);
    let results = [];
    
    if (!OrgState.currentData || !OrgState.currentData.categories) {
         console.warn("Org search aborted: data not ready.");
         return;
    }

    // Search categories
    OrgState.currentData.categories.forEach(category => {
        let categoryScore = 0;
        const catName = (category.name || '').toLowerCase();
        // Get raw HTML for snippet, but stripped text for scoring
        const catIntroHTML = (category.introduction || '');
        const catIntroText = stripHtml(catIntroHTML).toLowerCase();
        const catFullText = catName + ' ' + catIntroText;

        if (catName.includes(normalizedQuery) || catIntroText.includes(normalizedQuery)) categoryScore += 50;
        if (searchWords.every(w => catFullText.includes(w))) categoryScore += 25;
        searchWords.forEach(w => {
            if (catFullText.includes(w)) categoryScore += 1;
        });

        if (categoryScore > 0) {
            results.push({
                type: 'category',
                title: category.name,
                snippet: getContextSnippet(catIntroHTML, normalizedQuery), // Use global function
                id: category.id,
                score: categoryScore
            });
        }
        
        // Search strategies
        category.strategies.forEach(strategy => {
            let strategyScore = 0;
            const stratTitle = (strategy.title || '').toLowerCase();
            // Get raw HTML for snippet, but stripped text for scoring
            const stratDescHTML = (strategy.description || '');
            const stratIntroHTML = (strategy.introduction || '');
            const stratDescText = stripHtml(stratDescHTML).toLowerCase();
            const stratIntroText = stripHtml(stratIntroHTML).toLowerCase();
            
            const fullText = stratTitle + ' ' + stratDescText + ' ' + stratIntroText;

            if (stratTitle.includes(normalizedQuery)) strategyScore += 100; // Title exact phrase
            else if (fullText.includes(normalizedQuery)) strategyScore += 50; // Body exact phrase
            
            if (searchWords.every(w => fullText.includes(w))) strategyScore += 25; // All words
            
            searchWords.forEach(w => {
                if (stratTitle.includes(w)) strategyScore += 10; // Title any word
                if (stratDescText.includes(w) || stratIntroText.includes(w)) strategyScore += 1; // Body any word
            });

            if (strategyScore > 0) {
                let matchedContent = stratIntroHTML || stratDescHTML || strategy.title;
                if (fullText.includes(normalizedQuery)) {
                    if (stratIntroText.includes(normalizedQuery)) matchedContent = stratIntroHTML;
                    else if (stratDescText.includes(normalizedQuery)) matchedContent = stratDescHTML;
                }

                results.push({
                    type: 'strategy',
                    title: strategy.title,
                    category: category.name,
                    snippet: getContextSnippet(matchedContent, normalizedQuery), // Use global function
                    id: strategy.id,
                    categoryId: category.id,
                    score: strategyScore
                });
            }
        });
    });
    
    // Sort results by score (descending)
    results.sort((a, b) => b.score - a.score);
    
    displayOrgSearchResults(results, normalizedQuery);
}

/*Display search results*/
function displayOrgSearchResults(results, query) {
    const resultsContainer = document.getElementById('search-results');
    if (!resultsContainer) return;
    
    if (results.length === 0) {
        const message = `No results found for "${query}"`;
        resultsContainer.innerHTML = `<div class="no-results">${message}</div>`;
        resultsContainer.style.display = 'block';
        return;
	}
    
    const html = `
        <div class="search-results-header">
            <h4>Search Results for "${query}" (${results.length})</h4>
            <button onclick="clearOrgSearchResults()">Clear</button>
        </div>
        <div class="search-results-list">
            ${results.map(result => `
                <div class="search-result-item" onclick="navigateToOrgResult('${result.type}', '${result.id}', '${result.categoryId}')">
                    <div class="result-type-badge">${result.type}</div>
                    <h5 class="result-title">${result.title}</h5>
                    ${result.category ? `<p class="result-category">${result.category}</p>` : ''}
                    <div class="search-result-snippet">${result.snippet || ''}</div>
                </div>
            `).join('')}
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    resultsContainer.style.display = 'block';
}

/**
 * Clear organization search results
 */
function clearOrgSearchResults() {
    const resultsContainer = document.getElementById('search-results');
    if (resultsContainer) {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
    }
    const searchInput = document.getElementById('org-search-input');
    if (searchInput) searchInput.value = '';
}

/**
 * Navigate to search result
 */
function navigateToOrgResult(type, id, categoryId) {
    let targetElement;
    
    if (type === 'category') {
        targetElement = document.getElementById(id);
    } else if (type === 'strategy') {
        // First, ensure the parent category accordion is open
        const categoryElement = document.getElementById(categoryId);
        if (categoryElement && categoryElement.classList.contains('is-collapsed')) {
            // Click the header to open it
            categoryElement.previousElementSibling.click();
        }
        targetElement = document.querySelector(`[data-strategy-id="${id}"]`);
    }

    if (targetElement) {
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Highlight
        targetElement.style.backgroundColor = 'var(--color-secondary-hover)';
        setTimeout(() => {
            targetElement.style.transition = 'background-color 1s ease';
            targetElement.style.backgroundColor = '';
        }, 2000);
    }
    
    clearOrgSearchResults();
}

/**
 * Export selected strategies as customized implementation plan
 */
function exportImplementationPlan() {
    const selectedStrategies = OrgState.selectedStrategies;
    
    if (selectedStrategies.length === 0) {
        alert('Please select at least one strategy to compare and export.');
        return;
    }
    
    const plan = generateImplementationPlan(selectedStrategies);
    downloadAsFile(plan, 'custom-implementation-plan.html', 'text/html');
}

/**
 * Generate implementation plan HTML
 */
function generateImplementationPlan(strategies) {
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Custom Wellness Implementation Plan</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; line-height: 1.6; }
        h1 { color: #2c5282; }
        .strategy { border: 1px solid #e2e8f0; padding: 20px; margin: 20px 0; border-radius: 8px; }
        .strategy-title { color: #2d3748; font-size: 1.3em; margin-bottom: 10px; }
        .timeline { background: #edf2f7; padding: 10px; border-radius: 4px; margin: 10px 0; }
        .cost { background: #fef5e7; padding: 10px; border-radius: 4px; margin: 10px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #cbd5e0; padding: 10px; text-align: left; }
        th { background: #edf2f7; }
    </style>
</head>
<body>
    <h1>Custom Wellness Implementation Plan</h1>
    <p>Generated on: ${new Date().toLocaleDateString()}</p>
    
    <div class="strategies">
        ${strategies.map((strategy, idx) => `
            <div class="strategy">
                <h2 class="strategy-title">${idx + 1}. ${strategy.title}</h2>
                <p><strong>Description:</strong> ${strategy.description}</p>
                
                <div class="timeline">
                    <strong>Timeline:</strong> ${getNestedValue(strategy, 'implementation.timeline') || 'TBD'}
                </div>
                
                <div class="cost">
                    <strong>Estimated Cost:</strong> ${getNestedValue(strategy, 'implementation.estimated_cost') || 'TBD'}
                </div>
                
                <h3>Implementation Steps</h3>
                <ul>
                    ${(getNestedValue(strategy, 'implementation.resources_required') || []).map(resource => `
                        <li>${resource}</li>
                    `).join('') || '<li>Details to be determined</li>'}
                </ul>
                
                <h3>Expected Outcomes</h3>
                <p><strong>Before:</strong> ${getNestedValue(strategy, 'before_after.before_state') || 'N/A'}</p>
                <p><strong>After:</strong> ${getNestedValue(strategy, 'before_after.after_state') || 'N/A'}</p>
                
                <h3>Success Metrics</h3>
                <ul>
                    ${(strategy.metrics || []).map(metric => `<li>${metric}</li>`).join('') || '<li>Metrics TBD</li>'}
                </ul>
                
                ${strategy.pitfalls ? `
                    <h3>Common Pitfalls to Avoid</h3>
                    <ul>
                        ${strategy.pitfalls.map(pitfall => `<li>${pitfall}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `).join('')}
    </div>
    
    <h2>Summary Timeline</h2>
    <table>
        <tr>
            <th>Strategy</th>
            <th>Timeline</th>
            <th>Cost</th>
            <th>Difficulty</th>
        </tr>
        ${strategies.map(s => `
            <tr>
                <td>${s.title}</td>
                <td>${getNestedValue(s, 'implementation.timeline') || 'TBD'}</td>
                <td>${getNestedValue(s, 'implementation.estimated_cost') || 'TBD'}</td>
                <td>${getNestedValue(s, 'implementation.difficulty') || 'TBD'}</td>
            </tr>
        `).join('')}
    </table>
</body>
</html>
    `;
    
    return html;
}

/**
 * Download content as file
 */
function downloadAsFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

/*Export executive summary for board presentation*/
function exportExecutiveSummary() {
    const data = OrgState.currentData?.executive_summary;
    if (!data) {
        alert("Error: Executive Summary data not found.");
        return;
    }
    
    const content = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-R">
        <title>Executive Summary: The Case for Wellness</title>
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 800px; margin: 20px auto; padding: 20px; line-height: 1.6; color: #333; }
            h1 { color: #005a70; border-bottom: 2px solid #005a70; padding-bottom: 10px; }
            h2 { color: #007a94; margin-top: 30px; }
            h3 { color: #333; margin-top: 20px; }
            .intro { font-size: 1.1em; font-style: italic; color: #444; }
            .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
            .metric-card { border: 1px solid #ddd; border-left: 5px solid #007a94; padding: 15px; border-radius: 5px; background: #f9f9f9; }
            .metric-value { font-size: 2em; font-weight: 600; color: #005a70; margin: 0; }
            .metric-label { font-size: 1.1em; font-weight: 500; margin: 5px 0 0 0; }
            .metric-detail { font-size: 0.9em; color: #555; margin: 5px 0; }
            .metric-source { font-size: 0.8em; font-style: italic; color: #777; margin-top: 10px; }
            .section-item { margin-bottom: 20px; padding-left: 15px; border-left: 3px solid #007a94; }
            .item-summary { font-weight: 600; font-style: italic; color: #555; }
            .item-details { padding-left: 15px; border-left: 3px solid #ddd; margin-top: 10px; }
            .item-details p { margin-top: 5px; }
            .timeline { background: #f0f8ff; border: 1px solid #cce4ff; padding: 15px; border-radius: 5px; }
        </style>
    </head>
    <body>
        <h1>${data.title}</h1>
        <p class="intro">${data.introduction}</p>

        <h2>Key Metrics</h2>
        <div class="metrics-grid">
            ${data.key_metrics.map(metric => `
                <div class="metric-card">
                    <p class="metric-value">${metric.value}</p>
                    <p class="metric-label">${metric.label}</p>
                    <p class="metric-detail">${metric.detail}</p>
                    <p class="metric-source">Source: ${metric.source}</p>
                </div>
            `).join('')}
        </div>

        <h2>Critical Actions</h2>
        ${data.critical_actions.map(item => `
            <div class="section-item">
                <h3>${item.action}</h3>
                <p class="item-summary">${item.summary}</p>
                <div class="item-details">${item.details_expanded}</div>
            </div>
        `).join('')}

        <h2>Strategic Alignment</h2>
        ${data.strategic_alignment.map(item => `
            <div class="section-item">
                <h3>${item.objective}</h3>
                <p class="item-summary">${item.summary}</p>
                <div class="item-details">${item.details_expanded}</div>
            </div>
        `).join('')}

        <div class="timeline">
            <strong>Timeline Overview:</strong> ${data.timeline_overview}
        </div>
    </body>
    </html>
    `;
    downloadAsFile(content, 'Executive_Summary_Wellness_Case.html', 'text/html');
}

/*Export roadmap*/
function exportRoadmap() {
    // This function was not fully defined, creating a simple export
    alert("Export Roadmap feature is in development. Use 'Export Comparison' for selected strategies.");
}


/**
 * Interactive ROI calculator
 * @param {Object} orgDetails - Organization size, budget, current metrics
 */
function calculateWellnessROI(orgDetails, modelAssumptions) {
    const {
        numProviders, year1Investment, sustainingInvestment,
        projectionYears, avgSalary
    } = orgDetails;
    
    // Create local copies to modify during projection
    let { currentBurnoutRate, currentTurnoverRate } = orgDetails;

    const {
        turnoverCostMultiplier, productivityLossRate, maxEffectiveInvestment,
        year1BurnoutReduction, year1TurnoverReduction,
        sustainBurnoutReduction, sustainTurnoverReduction
    } = modelAssumptions;

    // --- 1. Calculate Baseline Costs (The problem we're solving) ---
    const turnoverCostPerProvider = avgSalary * turnoverCostMultiplier;
    const productivityLossPerBurnout = avgSalary * productivityLossRate;
    
    const calculateAnnualCost = (burnoutRate, turnoverRate) => {
        const turnoverCost = numProviders * turnoverRate * turnoverCostPerProvider;
        const productivityLoss = (numProviders * burnoutRate) * productivityLossPerBurnout;
        return turnoverCost + productivityLoss;
    };
    
    const baselineAnnualCost = calculateAnnualCost(currentBurnoutRate, currentTurnoverRate);
    const baselineProvidersInBurnout = numProviders * currentBurnoutRate;
    const baselineProvidersTurningOver = numProviders * currentTurnoverRate;
    
    // --- 2. Project Year-by-Year ---
    let projectedData = [];
    let cumulativeNetSavings = 0;
    
    // Calculate the investment "power"
    const year1InvestmentPerProvider = (numProviders > 0) ? (year1Investment / numProviders) : 0;
    const sustainInvestmentPerProvider = (numProviders > 0) ? (sustainingInvestment / numProviders) : 0;
    
    const year1InvestmentRatio = (maxEffectiveInvestment > 0) ? Math.min(1, year1InvestmentPerProvider / maxEffectiveInvestment) : 0;
    const sustainInvestmentRatio = (maxEffectiveInvestment > 0) ? Math.min(1, sustainInvestmentPerProvider / maxEffectiveInvestment) : 0;
    
    // Max potential reductions are applied based on investment ratio
    const year1BurnoutReductionEffect = year1BurnoutReduction * year1InvestmentRatio;
    const year1TurnoverReductionEffect = year1TurnoverReduction * year1InvestmentRatio;
    
    const sustainBurnoutReductionEffect = sustainBurnoutReduction * sustainInvestmentRatio;
    const sustainTurnoverReductionEffect = sustainTurnoverReduction * sustainInvestmentRatio;

    for (let year = 1; year <= projectionYears; year++) {
        let investment = (year === 1) ? year1Investment : sustainingInvestment;
        
        // Apply reductions
		if (year === 1) {
            currentBurnoutRate = Math.max(0, currentBurnoutRate * (1 - year1BurnoutReductionEffect));
            currentTurnoverRate = Math.max(0, currentTurnoverRate * (1 - year1TurnoverReductionEffect));
        } else {
            currentBurnoutRate = Math.max(0, currentBurnoutRate * (1 - sustainBurnoutReductionEffect));
            currentTurnoverRate = Math.max(0, currentTurnoverRate * (1 - sustainTurnoverReductionEffect));
        }
        
        // Calculate new costs and savings
        const newAnnualCost = calculateAnnualCost(currentBurnoutRate, currentTurnoverRate);
        const annualSavings = baselineAnnualCost - newAnnualCost;
        const netSavingsForYear = annualSavings - investment;
        cumulativeNetSavings += netSavingsForYear;
        
        // --- Add human impact data to projected data ---
        projectedData.push({
            year: `Year ${year}`,
            investment: investment,
            annualSavings: Math.round(annualSavings),
            netSavingsForYear: Math.round(netSavingsForYear),
            cumulativeNetSavings: Math.round(cumulativeNetSavings),
            // Store these for the new Human Impact chart
            burnoutRate: currentBurnoutRate, 
            turnoverRate: currentTurnoverRate
        });
    }
    
    // --- 3. Calculate Summary Stats ---
    const totalInvestment = year1Investment + (sustainingInvestment * (projectionYears - 1));
    const totalSavings = projectedData.reduce((acc, year) => acc + year.annualSavings, 0);
    const totalNetSavings = totalSavings - totalInvestment;
    const finalROI = (totalInvestment > 0) ? (totalNetSavings / totalInvestment) * 100 : 0;

    // Find break-even point
    let breakEvenYear = 'N/A';
    const breakEven = projectedData.find(d => d.cumulativeNetSavings > 0);
    if (breakEven) {
        breakEvenYear = breakEven.year;
    }
    
    // --- Calculate total human impact metrics ---
    const finalProjectedProvidersInBurnout = numProviders * currentBurnoutRate;
    const finalProjectedProvidersTurningOver = numProviders * currentTurnoverRate;
    
    const totalBurnoutAverted = (baselineProvidersInBurnout - finalProjectedProvidersInBurnout);
    const totalProvidersRetained = projectedData.reduce((sum, year) => 
	  sum + (baselineProvidersTurningOver - (year.turnoverRate * numProviders)), 0
	);

    return {
        projectedData,
        summary: {
            totalInvestment: Math.round(totalInvestment),
            totalSavings: Math.round(totalSavings),
            totalNetSavings: Math.round(totalNetSavings),
            finalROI: Math.round(finalROI),
            breakEvenYear: breakEvenYear,
            // Add new human impact numbers
            totalBurnoutAverted: Math.round(totalBurnoutAverted),
            totalProvidersRetained: Math.round(totalProvidersRetained),
            baselineBurnoutRate: orgDetails.currentBurnoutRate, // Pass original rate for summary
            baselineTurnoverRate: orgDetails.currentTurnoverRate // Pass original rate for summary
        }
    };
}

function validateROIForm(formData) {
    const fields = [
        { name: 'numProviders', min: 1, label: 'Number of Providers' },
        { name: 'avgSalary', min: 1, label: 'Average Provider Salary' },
        { name: 'currentBurnoutRate', min: 0, max: 100, label: 'Burnout Rate' },
        { name: 'currentTurnoverRate', min: 0, max: 100, label: 'Turnover Rate' },
        { name: 'year1Investment', min: 0, label: 'Year 1 Investment' },
        { name: 'sustainingInvestment', min: 0, label: 'Sustaining Investment' },
        { name: 'projectionYears', min: 1, max: 10, label: 'Projection Period' },
        { name: 'turnoverCostMultiplier', min: 0, label: 'Turnover Cost' },
        { name: 'productivityLossRate', min: 0, max: 100, label: 'Productivity Loss (as % of Salary)' },
        { name: 'maxEffectiveInvestment', min: 1, label: 'Max Effective Investment' },
        { name: 'year1BurnoutReduction', min: 0, max: 100, label: 'Year 1 Burnout Reduction' },
        { name: 'year1TurnoverReduction', min: 0, max: 100, label: 'Year 1 Turnover Reduction' },
        { name: 'sustainBurnoutReduction', min: 0, max: 100, label: 'Sustaining Burnout Reduction' },
        { name: 'sustainTurnoverReduction', min: 0, max: 100, label: 'Sustaining Turnover Reduction' }
    ];

    for (const field of fields) {
        const val = formData.get(field.name);
        if (val === null || val === '') {
            return `Error: "${field.label}" cannot be empty.`;
        }
        const numVal = parseFloat(val);
        if (isNaN(numVal)) {
            return `Error: "${field.label}" must be a number.`;
        }
        if (field.min !== undefined && numVal < field.min) {
            return `Error: "${field.label}" must be at least ${field.min}.`;
        }
        if (field.max !== undefined && numVal > field.max) {
            return `Error: "${field.label}" cannot be over ${field.max}.`;
        }
    }
    return null; // All valid
}

/*Display ROI calculator interface*/
function displayROICalculator(containerId = 'roi-calculator') {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const html = `
        <div class="roi-calculator">
            <p class="calculator-desc">Model the multi-year financial impact of a sustained wellness program.</p>
            
            <form id="roi-form" class="roi-form">
                <div class="form-group">
                    <label>Number of Providers:</label>
                    <input type="number" name="numProviders" value="100" min="1" />
                </div>
                
                <div class="form-group">
                    <label>Average Provider Salary:</label>
                    <input type="number" name="avgSalary" value="250000" min="0" />
                </div>
                
                <div class="form-group">
                    <label>Current Burnout Rate (%):</label>
                    <input type="number" name="currentBurnoutRate" value="50" min="0" max="100" />
                </div>
                
                <div class="form-group">
                    <label>Current Annual Turnover Rate (%):</label>
                    <input type="number" name="currentTurnoverRate" value="15" min="0" max="100" />
                </div>

                <div class="form-group">
                    <label>Year 1 Wellness Investment:</label>
                    <input type="number" name="year1Investment" value="500000" min="0" />
                </div>
                
                <div class="form-group">
                    <label>Sustaining Investment (Years 2+):</label>
                    <input type="number" name="sustainingInvestment" value="250000" min="0" />
                </div>
                
                <div class="form-group">
                    <label>Projection Period (Years):</label>
                    <input type="number" name="projectionYears" value="5" min="1" max="10" />
                </div>

                <button type="button" class="btn btn--secondary btn--sm" style="width: 100%; margin-top: 10px;" onclick="toggleAdvancedROI()">
                    Advanced Model Assumptions
                </button>
                
                <div id="roi-advanced-settings" style="display: none; background: var(--color-background); padding: 16px; border-radius: 8px; margin-top: 16px;">
					<div class="form-group">
						<label>Turnover Cost (as % of Salary) <span class="tooltip" title="Cost to replace a provider, including recruitment, onboarding, and lost revenue. (e.g., 150 = 1.5x salary)">ⓘ</span></label>
						<input type="number" name="turnoverCostMultiplier" value="150" min="0" />
					</div>
					<div class="form-group">
						<label>Productivity Loss (as % of Salary) <span class="tooltip" title="Estimated productivity loss from a burned-out provider vs. a non-burned-out one. (e.g., 20 = 20% loss)">ⓘ</span></label>
						<input type="number" name="productivityLossRate" value="20" min="0" />
					</div>
					<div class="form-group">
						<label>Max Effective Investment ($/Provider) <span class="tooltip" title="The max investment per provider this model will use to calculate ROI. (e.g., $5,000)">ⓘ</span></label>
						<input type="number" name="maxEffectiveInvestment" value="5000" min="0" />
					</div>
                    
                    <hr style="border: none; border-top: 1px solid var(--color-border); margin: 20px 0;">

                    <div class="form-group">
						<label>Year 1 Burnout Reduction (%) <span class="tooltip" title="Max burnout reduction % in Year 1 at full investment. (Default: 35%)">ⓘ</span></label>
						<input type="number" name="year1BurnoutReduction" value="35" min="0" max="100" />
					</div>
                    <div class="form-group">
						<label>Year 1 Turnover Reduction (%) <span class="tooltip" title="Max turnover reduction % in Year 1 at full investment. (Default: 25%)">ⓘ</span></label>
						<input type="number" name="year1TurnoverReduction" value="25" min="0" max="100" />
					</div>
                    <div class="form-group">
						<label>Sustaining Burnout Reduction (%) <span class="tooltip" title="Max sustaining burnout reduction % in Years 2+ at full investment. (Default: 10%)">ⓘ</span></label>
						<input type="number" name="sustainBurnoutReduction" value="10" min="0" max="100" />
					</div>
                    <div class="form-group">
						<label>Sustaining Turnover Reduction (%) <span class="tooltip" title="Max sustaining turnover reduction % in Years 2+ at full investment. (Default: 5%)">ⓘ</span></label>
						<input type="number" name="sustainTurnoverReduction" value="5" min="0" max="100" />
					</div>
                </div>
                
                <button type="button" class="btn-primary" style="margin-top: 20px;" onclick="calculateAndDisplayROI()">Calculate Projection</button>
            </form>
            
            <div id="roi-results" class="roi-results" style="display: none;">
                </div>
        </div>
    `;
    container.innerHTML = html;
}

// Helper function to toggle advanced settings
function toggleAdvancedROI() {
    const settings = document.getElementById('roi-advanced-settings');
    if (settings) {
        settings.style.display = (settings.style.display === 'none') ? 'block' : 'none';
    }
}

/*Calculate and display ROI results*/
function calculateAndDisplayROI() {
    const form = document.getElementById('roi-form');
    const formData = new FormData(form);
    const resultsContainer = document.getElementById('roi-results');

    const validationError = validateROIForm(formData);
    if (validationError) {
        // Clear old results and show error
        resultsContainer.innerHTML = `<div class="roi-metric" style="border-color: var(--color-error); background: var(--color-bg-4); grid-column: 1 / -1;">
            <div class="metric-label" style="color: var(--color-error); font-weight: 600;">${validationError}</div>
        </div>`;
        resultsContainer.style.display = 'block';
        return;
    }
	
    const orgDetails = {
        numProviders: parseInt(formData.get('numProviders')) || 100,
        year1Investment: parseInt(formData.get('year1Investment')) || 500000,
        sustainingInvestment: parseInt(formData.get('sustainingInvestment')) || 250000,
        projectionYears: parseInt(formData.get('projectionYears')) || 5,
        currentBurnoutRate: (parseInt(formData.get('currentBurnoutRate')) || 50) / 100,
        currentTurnoverRate: (parseInt(formData.get('currentTurnoverRate')) || 15) / 100,
        avgSalary: parseInt(formData.get('avgSalary')) || 250000
    };

    const modelAssumptions = {
        turnoverCostMultiplier: (parseInt(formData.get('turnoverCostMultiplier')) || 150) / 100,
        productivityLossRate: (parseInt(formData.get('productivityLossRate')) || 20) / 100,
        maxEffectiveInvestment: parseInt(formData.get('maxEffectiveInvestment')) || 5000,
        year1BurnoutReduction: (parseInt(formData.get('year1BurnoutReduction')) || 35) / 100,
        year1TurnoverReduction: (parseInt(formData.get('year1TurnoverReduction')) || 25) / 100,
        sustainBurnoutReduction: (parseInt(formData.get('sustainBurnoutReduction')) || 10) / 100,
        sustainTurnoverReduction: (parseInt(formData.get('sustainTurnoverReduction')) || 5) / 100
    };
    
    // --- IMPROVEMENT 2: Run Scenario Analysis ---
    // 1. Expected Scenario (User's inputs)
    const expectedResults = calculateWellnessROI(orgDetails, modelAssumptions);
    
    // 2. Pessimistic Scenario (50% effectiveness)
    const pessimisticAssumptions = { ...modelAssumptions,
        year1BurnoutReduction: modelAssumptions.year1BurnoutReduction * 0.5,
        year1TurnoverReduction: modelAssumptions.year1TurnoverReduction * 0.5,
        sustainBurnoutReduction: modelAssumptions.sustainBurnoutReduction * 0.5,
        sustainTurnoverReduction: modelAssumptions.sustainTurnoverReduction * 0.5
    };
    const pessimisticResults = calculateWellnessROI(orgDetails, pessimisticAssumptions);
    
    // 3. Optimistic Scenario (150% effectiveness)
    const optimisticAssumptions = { ...modelAssumptions,
        year1BurnoutReduction: modelAssumptions.year1BurnoutReduction * 1.5,
        year1TurnoverReduction: modelAssumptions.year1TurnoverReduction * 1.5,
        sustainBurnoutReduction: modelAssumptions.sustainBurnoutReduction * 1.5,
        sustainTurnoverReduction: modelAssumptions.sustainTurnoverReduction * 1.5
    };
    const optimisticResults = calculateWellnessROI(orgDetails, optimisticAssumptions);
    
    
    // --- Re-render the results container ---
    resultsContainer.innerHTML = `
        <h4>ROI Analysis Results</h4>
        <div class="roi-results-grid" id="roi-summary-cards"></div>
        
        <div id="roi-scenario-analysis-container"></div>
        
        <div id="roi-human-impact-chart-container" class="chart-container" style="margin-top: 32px; height: 300px;">
            <canvas id="roiHumanImpactChart"></canvas>
        </div>
        
        <div id="roi-chart-container" class="chart-container" style="margin-top: 32px; height: 400px;">
            <canvas id="roiChart"></canvas>
        </div>
        
        <div class="roi-recommendations" id="roi-recommendations-container"></div>
		<div class="roi-methodology" id="roi-methodology-container"></div>
    `;

    const { summary } = expectedResults; // Use expected results for main display
	const roiClass = summary.finalROI >= 0 ? 'positive' : 'negative';
	const netSavingsClass = summary.totalNetSavings >= 0 ? 'positive' : 'negative';
    
    // --- 1. Render Summary Cards (with Human Impact) ---
    const summaryContainer = document.getElementById('roi-summary-cards');
    summaryContainer.innerHTML = `
        <div class="roi-metric highlight">
			<div class="metric-label">Net Position (${orgDetails.projectionYears} Yrs)</div>
			<div class="metric-value ${netSavingsClass}">
                $${summary.totalNetSavings.toLocaleString()}
			</div>
		</div>
		<div class="roi-metric highlight">
			<div class="metric-label">Total ROI</div>
			<div class="metric-value ${roiClass}">
                ${summary.finalROI}%
			</div>
		</div>
        <div class="roi-metric">
            <div class="metric-label">Break-Even Point</div>
            <div class="metric-value">${summary.breakEvenYear}</div>
        </div>
        <div class="roi-metric">
            <div class="metric-label">Providers Retained (Cumulative)</div>
            <div class="metric-value positive">${summary.totalProvidersRetained.toLocaleString()}</div>
        </div>
        <div class="roi-metric">
            <div class="metric-label">Providers Averted from Burnout (by Year ${orgDetails.projectionYears})</div>
            <div class="metric-value positive">${summary.totalBurnoutAverted.toLocaleString()}</div>
        </div>
        <div class="roi-metric">
            <div class="metric-label">Total Investment (${orgDetails.projectionYears} Yrs)</div>
            <div class="metric-value investment">$${summary.totalInvestment.toLocaleString()}</div>
        </div>
    `;

    // --- 2. Render Scenario Analysis ---
    renderScenarioAnalysis(pessimisticResults.summary, expectedResults.summary, optimisticResults.summary);

    // --- 3. Render Charts ---
    // Chart 1: The main financial chart
    renderFinancialImpactChart(expectedResults.projectedData);
    // Chart 2: The new human impact chart
    renderHumanImpactChart(expectedResults.projectedData, orgDetails);
    
	// --- 4. Render High-Level Recommendation ( Executive Blurb ) ---
    const recommendationsContainer = document.getElementById('roi-recommendations-container');
    recommendationsContainer.innerHTML = `
        <h5>Executive Summary</h5>
        <p>This <strong>${orgDetails.projectionYears}-year projection</strong> shows an expected <strong>net position of $${summary.totalNetSavings.toLocaleString()}</strong> and a total <strong>ROI of ${summary.finalROI}%</strong>.</p>
        <ul>
            <li>The program is projected to become profitable by <strong>${summary.breakEvenYear}</strong>.</li>
            <li>Over ${orgDetails.projectionYears} years, this investment is projected to retain <strong>${summary.totalProvidersRetained} providers</strong> and prevent burnout for <strong>${summary.totalBurnoutAverted} providers</strong>.</li>
        </ul>
    `;
	
	// --- 5. Render Calculation Methodology Summary ---
	const methodologyContainer = document.getElementById('roi-methodology-container');
	if (methodologyContainer) {
	  const methodologySummary = generateCalculationSummary(orgDetails, modelAssumptions, summary);
	  methodologyContainer.innerHTML = methodologySummary;
	}
    
    resultsContainer.style.display = 'block';
}

/**
 * Renders the Scenario Analysis table
 */
function renderScenarioAnalysis(pessimistic, expected, optimistic) {
    const container = document.getElementById('roi-scenario-analysis-container');
    if (!container) return;
    
    const formatValue = (value) => {
        const num = Math.round(value);
        const cssClass = num >= 0 ? 'positive' : 'negative';
        return `<strong class="${cssClass}">$${num.toLocaleString()}</strong>`;
    };

    container.innerHTML = `
        <div class="scenario-analysis">
            <h4>Scenario Analysis (Net Position)</h4>
            <table class="comparison-table">
                <thead>
                    <tr>
                        <th>Scenario</th>
                        <th>Net Savings (Total)</th>
                        <th>ROI</th>
                        <th>Break-Even</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td><strong>Pessimistic</strong> (50% Effectiveness)</td>
                        <td>${formatValue(pessimistic.totalNetSavings)}</td>
                        <td><strong class="${pessimistic.finalROI >= 0 ? 'positive' : 'negative'}">${pessimistic.finalROI.toFixed(0)}%</strong></td>
                        <td>${pessimistic.breakEvenYear}</td>
                    </tr>
                    <tr class="expected-row">
                        <td><strong>Expected</strong> (100% Effectiveness)</td>
                        <td>${formatValue(expected.totalNetSavings)}</td>
                        <td><strong class="${expected.finalROI >= 0 ? 'positive' : 'negative'}">${expected.finalROI.toFixed(0)}%</strong></td>
                        <td>${expected.breakEvenYear}</td>
                    </tr>
                    <tr>
                        <td><strong>Optimistic</strong> (150% Effectiveness)</td>
                        <td>${formatValue(optimistic.totalNetSavings)}</td>
                        <td><strong class="${optimistic.finalROI >= 0 ? 'positive' : 'negative'}">${optimistic.finalROI.toFixed(0)}%</strong></td>
                        <td>${optimistic.breakEvenYear}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    `;
}

/**
 * Renders the Human Impact Chart (Burnout % and Turnover %)
 */
function renderHumanImpactChart(projectedData, orgDetails) {
    const chartContainer = document.getElementById('roi-human-impact-chart-container');
    if (!chartContainer) return;
    
    const canvas = chartContainer.querySelector('canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
	
	if (roiHumanImpactChartInstance) {
        roiHumanImpactChartInstance.destroy();
    }
    
    // Get theme colors
    const currentTheme = document.documentElement.getAttribute('data-color-scheme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim();
    const gridColor = 'rgba(var(--color-gray-400-rgb), 0.1)';
    const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim();
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim();
    const textPrimaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();

    const warningColor = (currentTheme === 'dark' ? 
        getComputedStyle(document.documentElement).getPropertyValue('--color-orange-400') : 
        getComputedStyle(document.documentElement).getPropertyValue('--color-orange-500')).trim();
        
    const errorColor = (currentTheme === 'dark' ? 
        getComputedStyle(document.documentElement).getPropertyValue('--color-red-400') : 
        getComputedStyle(document.documentElement).getPropertyValue('--color-red-500')).trim();

    roiHumanImpactChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Start', ...projectedData.map(d => d.year)],
            datasets: [
                {
                    label: 'Burnout Rate',
                    data: [orgDetails.currentBurnoutRate, ...projectedData.map(d => d.burnoutRate)],
                    borderColor: warningColor,
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointBackgroundColor: warningColor,
                },
                {
                    label: 'Turnover Rate',
                    data: [orgDetails.currentTurnoverRate, ...projectedData.map(d => d.turnoverRate)],
                    borderColor: errorColor,
                    backgroundColor: 'transparent',
                    fill: false,
                    tension: 0.1,
                    pointRadius: 4,
                    pointBackgroundColor: errorColor,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Projected Human Impact (Rates)',
                    color: textPrimaryColor,
                    font: { weight: '600', size: 16 }
                },
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: { color: textColor, usePointStyle: true, boxWidth: 8 }
                },
                tooltip: {
                    backgroundColor: surfaceColor,
                    titleColor: textPrimaryColor,
                    bodyColor: textColor,
                    borderColor: borderColor,
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += (context.parsed.y * 100).toFixed(1) + '%';
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor, drawOnChartArea: false }
                },
                y: {
                    position: 'left',
                    ticks: { 
                        color: textColor, 
                        callback: (value) => (value * 100).toFixed(0) + '%' // Format as percentage
                    },
                    grid: { color: gridColor, borderDash: [5, 5] },
                    title: {
                        display: true,
                        text: 'Rate (%)',
                        color: textColor
                    }
                }
            }
        }
    });
}


/**
 * Renders the Financial Impact Chart (Annual vs. Cumulative)
 */
function renderFinancialImpactChart(projectedData) {
    const chartContainer = document.getElementById('roi-chart-container');
    if (!chartContainer) return;
    
    const canvas = chartContainer.querySelector('canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    
    // Destroy previous chart if it exists
    if (roiChartInstance) {
        roiChartInstance.destroy();
    }
	
	if (roiHumanImpactChartInstance) {
        roiHumanImpactChartInstance.destroy();
    }

    // --- ENHANCED STYLING ---
    const successRGB = getComputedStyle(document.documentElement).getPropertyValue('--color-success-rgb').trim();
    const currentTheme = document.documentElement.getAttribute('data-color-scheme') || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    
    const primaryRGB = (currentTheme === 'dark' ? 
        getComputedStyle(document.documentElement).getPropertyValue('--color-teal-300-rgb') : 
        getComputedStyle(document.documentElement).getPropertyValue('--color-teal-500-rgb')).trim();
        
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text-secondary').trim();
    const gridColor = 'rgba(var(--color-gray-400-rgb), 0.1)';
    const surfaceColor = getComputedStyle(document.documentElement).getPropertyValue('--color-surface').trim();
    const borderColor = getComputedStyle(document.documentElement).getPropertyValue('--color-border').trim();
    const textPrimaryColor = getComputedStyle(document.documentElement).getPropertyValue('--color-text').trim();

    // Create gradients for fills
    const savingsGradient = ctx.createLinearGradient(0, 0, 0, 400);
    savingsGradient.addColorStop(0, `rgba(${successRGB}, 0.6)`);
    savingsGradient.addColorStop(1, `rgba(${successRGB}, 0.1)`);

    const cumulativeGradient = ctx.createLinearGradient(0, 0, 0, 400);
    cumulativeGradient.addColorStop(0, `rgba(${primaryRGB}, 0.4)`);
    cumulativeGradient.addColorStop(1, `rgba(${primaryRGB}, 0)`);
    // --- END STYLING ENHANCEMENTS ---

    roiChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: projectedData.map(d => d.year),
            datasets: [
                {
                    label: 'Annual Savings',
                    data: projectedData.map(d => d.annualSavings),
                    backgroundColor: savingsGradient,
                    borderColor: `rgba(${successRGB}, 1)`,
                    borderWidth: 2,
                    borderRadius: 8,
                    borderSkipped: false,
                    type: 'bar',
                    yAxisID: 'y'
                },
                {
                    label: 'Cumulative Net Savings',
                    data: projectedData.map(d => d.cumulativeNetSavings),
                    backgroundColor: cumulativeGradient,
                    borderColor: `rgba(${primaryRGB}, 1)`,
                    type: 'line',
                    fill: true,
                    tension: 0.4,
                    pointBackgroundColor: `rgba(${primaryRGB}, 1)`,
                    pointBorderColor: surfaceColor,
                    pointBorderWidth: 2,
                    pointRadius: 5,
                    yAxisID: 'y'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Projected Financial Impact (Savings)',
                    color: textPrimaryColor,
                    font: { weight: '600', size: 16 }
                },
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        color: textColor,
                        font: { weight: '500' },
                        usePointStyle: true,
                        boxWidth: 8
                    }
                },
                tooltip: {
                    backgroundColor: surfaceColor,
                    titleColor: textPrimaryColor,
                    bodyColor: textColor,
                    borderColor: borderColor,
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            if (context.parsed.y !== null) {
                                label += new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { 
                        color: gridColor,
                        drawOnChartArea: false,
                    }
                },
                y: {
                    id: 'y',
                    position: 'left',
                    ticks: { 
                        color: textColor, 
                        callback: function(value) {
                            if (Math.abs(value) >= 1000000) return '$' + (value / 1000000) + 'm';
                            if (Math.abs(value) >= 1000) return '$' + (value / 1000) + 'k';
                            return '$' + value;
                        }
                    },
                    grid: { 
                        color: gridColor,
                        borderDash: [5, 5]
                    },
                    title: {
                        display: true,
                        text: 'Savings (USD)',
                        color: textColor
                    }
                }
            }
        }
    });
}


/*Generate a human-readable summary of the ROI calculation. Show inputs, methodology, and key outcomes*/
function generateCalculationSummary(orgDetails, modelAssumptions, summary) {
  const {
    numProviders,
    year1Investment,
    sustainingInvestment,
    projectionYears,
    currentBurnoutRate,
    currentTurnoverRate,
    avgSalary
  } = orgDetails;

  const {
    turnoverCostMultiplier,
    productivityLossRate,
    maxEffectiveInvestment,
    year1BurnoutReduction,
    year1TurnoverReduction,
    sustainBurnoutReduction,
    sustainTurnoverReduction
  } = modelAssumptions;

  // Build the narrative summary
  const summaryText = `
    <h4>Calculation Methodology & Assumptions</h4>
    
	<div class="summary-section note">
	  <p><strong>Note on Methodology:</strong> This model uses industry-standard assumptions 
	  about wellness program effectiveness. Actual results depend on implementation quality 
	  and organizational context. All "Advanced Assumptions" can be modified.</p>
	</div>
	
    <div class="summary-section">
      <h5>Organization Profile</h5>
      <p>
        This analysis models a <strong>${numProviders.toLocaleString()} provider</strong> organization with an average annual salary of <strong>$${avgSalary.toLocaleString()}</strong>.
      </p>
    </div>

    <div class="summary-section">
      <h5>Current State Challenges</h5>
      <ul>
        <li><strong>Burnout Rate:</strong> ${(currentBurnoutRate * 100).toFixed(0)}% of providers experiencing burnout</li>
        <li><strong>Turnover Rate:</strong> ${(currentTurnoverRate * 100).toFixed(0)}% annual provider turnover</li>
        <li><strong>Cost Per Departure:</strong> ${(avgSalary * turnoverCostMultiplier).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} (${(turnoverCostMultiplier * 100).toFixed(0)}% of salary)</li>
      </ul>
    </div>

    <div class="summary-section">
      <h5>Investment Strategy</h5>
      <ul>
        <li><strong>Year 1 Investment:</strong> $${year1Investment.toLocaleString()}</li>
        <li><strong>Sustaining Investment (Years 2-${projectionYears}):</strong> $${sustainingInvestment.toLocaleString()} per year</li>
        <li><strong>Total ${projectionYears}-Year Investment:</strong> $${summary.totalInvestment.toLocaleString()}</li>
      </ul>
    </div>

    <div class="summary-section">
      <h5>Impact Model (Based on Advanced Assumptions)</h5>
      <p>
        The calculation models how wellness interventions reduce burnout and prevent turnover through two mechanisms, scaled by investment:
      </p>
      <ul>
        <li><strong>Burnout Reduction:</strong> Model assumes a max <strong>${(year1BurnoutReduction * 100).toFixed(0)}%</strong> reduction in Year 1, and <strong>${(sustainBurnoutReduction * 100).toFixed(0)}%</strong> in subsequent years, scaled by investment.</li>
        <li><strong>Turnover Reduction:</strong> Model assumes a max <strong>${(year1TurnoverReduction * 100).toFixed(0)}%</strong> reduction in Year 1, and <strong>${(sustainTurnoverReduction * 100).toFixed(0)}%</strong> in subsequent years, scaled by investment.</li>
        <li><strong>Productivity Impact:</strong> Reduced burnout improves provider productivity (<strong>${(productivityLossRate * 100).toFixed(0)}%</strong> productivity loss prevented per burnout reduction).</li>
      </ul>
    </div>

	<div class="summary-section">
      <h5>Projected Outcomes (${projectionYears}-Year Horizon)</h5>
      <ul>
        <li><strong>Total Gross Savings:</strong> $${summary.totalSavings.toLocaleString()} (from turnover prevention + productivity gains)</li>
        <li><strong>Less: Total Investment:</strong> $${summary.totalInvestment.toLocaleString()}</li>
        <li><strong>Net Savings:</strong> <strong class="${summary.totalNetSavings >= 0 ? 'positive' : 'negative'}">$${summary.totalNetSavings.toLocaleString()}</strong></li>
        <li><strong>Return on Investment (ROI):</strong> <strong class="${summary.finalROI >= 0 ? 'positive' : 'negative'}">${summary.finalROI}%</strong></li>
        <li><strong>Profitability Achieved:</strong> <strong>${summary.breakEvenYear}</strong></li>
        <li><strong>Providers Retained (Cumulative):</strong> <strong class="positive">${summary.totalProvidersRetained.toLocaleString()}</strong></li>
        <li><strong>Providers Averted from Burnout:</strong> <strong class="positive">${summary.totalBurnoutAverted.toLocaleString()}</strong></li>
      </ul>
    </div>
	
    <div class="summary-section">
      <h5>Key Insights</h5>
      <ul>
        <li>For every $1 invested in provider wellness, the organization expects to save <strong>$${(summary.totalSavings / summary.totalInvestment).toFixed(2)}</strong> in turnover and productivity costs.</li>
        <li>By <strong>${summary.breakEvenYear}</strong>, the program is projected to become self-sustaining through cost avoidance alone.</li>
        <li>Over ${projectionYears} years, net savings of $${summary.totalNetSavings.toLocaleString()} represent the equivalent of <strong>${Math.abs((summary.totalNetSavings / avgSalary).toFixed(2))}</strong> average annual provider salaries.</li>
		<li>This investment also projects a cumulative retention of <strong>${summary.totalProvidersRetained} providers</strong> who would have otherwise left.</li>
      </ul>
    </div>

    <div class="summary-section note">
      <p>
        <strong>Note:</strong> These projections are based on the adjustable assumptions in the "Advanced Model Assumptions" section. 
        Actual results will vary based on program implementation quality, provider engagement, and organizational context.
      </p>
    </div>
  `;

  return summaryText;
}

/**
 * Find strategy by ID across all categories
 */
function findStrategyById(strategyId) {
    if (!OrgState.currentData || !OrgState.currentData.categories) return null;
    
    for (const category of OrgState.currentData.categories) {
        const strategy = category.strategies.find(s => s.id === strategyId);
        if (strategy) return strategy;
    }
    
    return null;
}

/**
 * Initialize all organization features
 */
async function initializeOrganizationFeatures() {
    // Load data
    const data = await loadOrganizationData();
	orgData = data;
    OrgState.currentData = data;

    if (data.error) {
        // Error is already displayed by loadOrganizationData
        return;
    }
    
    // Render sections if containers exist
    if (document.getElementById('executive-summary-container')) {
        renderExecutiveSummary(data);
    }
    
    if (document.getElementById('roadmap-container')) {
        renderImplementationRoadmap(data);
    }
    
    if (document.getElementById('provider-role-container')) {
        renderProviderRoleStrategies(data);
    }
    
    if (document.getElementById('roi-calculator')) {
        displayROICalculator();
    }

    // [NEW] Render the dynamic categories
    if (document.getElementById('categories-container')) {
        renderStrategyCategories(data);
    }
    
    // Initialize search
    const searchInput = document.getElementById('org-search-input');
    if (searchInput) {
        let orgSearchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(orgSearchTimeout);
            orgSearchTimeout = setTimeout(() => {
                searchOrganizationContent(e.target.value);
            }, 300); // 300ms debounce
        });
    }
    
    console.log('✅ Organization features initialized');
}

// Initialize on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}