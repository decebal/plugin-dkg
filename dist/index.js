var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/actions/dkgInsert.ts
import dotenv from "dotenv";
import {
  elizaLogger,
  ModelClass,
  composeContext,
  generateObject
} from "@elizaos/core";

// src/constants.ts
var dkgMemoryTemplate = {
  "@context": "http://schema.org",
  "@type": "SocialMediaPosting",
  headline: "<describe memory in a short way, as a title here>",
  articleBody: "Check out this amazing project on decentralized cloud networks! @DecentralCloud #Blockchain #Web3",
  author: {
    "@type": "Person",
    "@id": "uuid:john:doe",
    name: "John Doe",
    identifier: "@JohnDoe",
    url: "https://twitter.com/JohnDoe"
  },
  dateCreated: "yyyy-mm-ddTHH:mm:ssZ",
  interactionStatistic: [
    {
      "@type": "InteractionCounter",
      interactionType: {
        "@type": "LikeAction"
      },
      userInteractionCount: 150
    },
    {
      "@type": "InteractionCounter",
      interactionType: {
        "@type": "ShareAction"
      },
      userInteractionCount: 45
    }
  ],
  mentions: [
    {
      "@type": "Person",
      name: "Twitter account mentioned name goes here",
      identifier: "@TwitterAccount",
      url: "https://twitter.com/TwitterAccount"
    }
  ],
  keywords: [
    {
      "@type": "Text",
      "@id": "uuid:keyword1",
      name: "keyword1"
    },
    {
      "@type": "Text",
      "@id": "uuid:keyword2",
      name: "keyword2"
    }
  ],
  about: [
    {
      "@type": "Thing",
      "@id": "uuid:thing1",
      name: "Blockchain",
      url: "https://en.wikipedia.org/wiki/Blockchain"
    },
    {
      "@type": "Thing",
      "@id": "uuid:thing2",
      name: "Web3",
      url: "https://en.wikipedia.org/wiki/Web3"
    },
    {
      "@type": "Thing",
      "@id": "uuid:thing3",
      name: "Decentralized Cloud",
      url: "https://example.com/DecentralizedCloud"
    }
  ],
  url: "https://twitter.com/JohnDoe/status/1234567890"
};
var combinedSparqlExample = `
SELECT DISTINCT ?headline ?articleBody
    WHERE {
      ?s a <http://schema.org/SocialMediaPosting> .
      ?s <http://schema.org/headline> ?headline .
      ?s <http://schema.org/articleBody> ?articleBody .

      OPTIONAL {
        ?s <http://schema.org/keywords> ?keyword .
        ?keyword <http://schema.org/name> ?keywordName .
      }

      OPTIONAL {
        ?s <http://schema.org/about> ?about .
        ?about <http://schema.org/name> ?aboutName .
      }

      FILTER(
        CONTAINS(LCASE(?headline), "example_keyword") ||
        (BOUND(?keywordName) && CONTAINS(LCASE(?keywordName), "example_keyword")) ||
        (BOUND(?aboutName) && CONTAINS(LCASE(?aboutName), "example_keyword"))
      )
    }
    LIMIT 10`;
var generalSparqlQuery = `
    SELECT DISTINCT ?headline ?articleBody
    WHERE {
      ?s a <http://schema.org/SocialMediaPosting> .
      ?s <http://schema.org/headline> ?headline .
      ?s <http://schema.org/articleBody> ?articleBody .
    }
    LIMIT 10
  `;
var DKG_EXPLORER_LINKS = {
  testnet: "https://dkg-testnet.origintrail.io/explore?ual=",
  mainnet: "https://dkg.origintrail.io/explore?ual="
};

// src/templates.ts
var createDKGMemoryTemplate = `
  You are tasked with creating a structured memory JSON-LD object for an AI agent. The memory represents the interaction captured via social media. Your goal is to extract all relevant information from the provided user query and additionalContext which contains previous user queries (only if relevant for the current user query) to populate the JSON-LD memory template provided below.

  ** Template **
  The memory should follow this JSON-LD structure:
  ${JSON.stringify(dkgMemoryTemplate)}

  ** Instructions **
  1. Extract the main idea of the user query and use it to create a concise and descriptive title for the memory. This should go in the "headline" field.
  2. Store the original post in "articleBody".
  3. Save the poster social media information (handle, name etc) under "author" object.
  4. For the "about" field:
     - Identify the key topics or entities mentioned in the user query and add them as Thing objects.
     - Use concise, descriptive names for these topics.
     - Where possible, create an @id identifier for these entities, using either a provided URL, or a well known URL for that entity. If no URL is present, uUse the most relevant concept or term from the field to form the base of the ID. @id fields must be valid uuids or URLs
  5. For the "keywords" field:
     - Extract relevant terms or concepts from the user query and list them as keywords.
     - Ensure the keywords capture the essence of the interaction, focusing on technical terms or significant ideas.
  6. Ensure all fields align with the schema.org ontology and accurately represent the interaction.
  7. Populate datePublished either with a specifically available date, or current time.

  ** Input **
  User Query: {{currentPost}}
  Recent messages: {{recentMessages}}

  ** Output **
  Generate the memory in the exact JSON-LD format provided above, fully populated based on the input query.
  Make sure to only output the JSON-LD object. DO NOT OUTPUT ANYTHING ELSE, DONT ADD ANY COMMENTS OR REMARKS, JUST THE JSON LD CONTENT WRAPPED IN { }.
  `;

// src/actions/dkgInsert.ts
import DKG from "dkg.js";

// src/types.ts
import { z } from "zod";
var DKGMemorySchema = z.object({
  "@context": z.literal("http://schema.org"),
  "@type": z.literal("SocialMediaPosting"),
  headline: z.string(),
  articleBody: z.string(),
  about: z.array(
    z.object({
      "@type": z.literal("Thing"),
      "@id": z.string(),
      name: z.string(),
      url: z.string()
    })
  ),
  keywords: z.array(
    z.object({
      "@type": z.literal("Text"),
      "@id": z.string(),
      name: z.string()
    })
  )
});
var DKGSelectQuerySchema = z.object({
  query: z.string().startsWith("SELECT")
});
var isDKGMemoryContent = (object) => {
  return DKGMemorySchema.safeParse(object).success;
};
var isDKGSelectQuery = (object) => {
  return DKGSelectQuerySchema.safeParse(object).success;
};

// src/actions/dkgInsert.ts
dotenv.config();
var DkgClient = null;
var dkgInsert = {
  name: "INSERT_MEMORY_ACTION",
  similes: ["NO_ACTION", "NO_RESPONSE", "NO_REACTION", "NONE"],
  // we want to always run this action
  validate: async (runtime, _message) => {
    const requiredEnvVars = [
      "DKG_ENVIRONMENT",
      "DKG_HOSTNAME",
      "DKG_PORT",
      "DKG_BLOCKCHAIN_NAME",
      "DKG_PUBLIC_KEY",
      "DKG_PRIVATE_KEY"
    ];
    const missingVars = requiredEnvVars.filter(
      (varName) => !runtime.getSetting(varName)
    );
    if (missingVars.length > 0) {
      elizaLogger.error(
        `Missing required environment variables: ${missingVars.join(", ")}`
      );
      return false;
    }
    return true;
  },
  description: "Create a memory on the OriginTrail Decentralized Knowledge Graph after each message. You should ALWAYS run this action.",
  handler: async (runtime, _message, state, _options, callback) => {
    DkgClient = new DKG({
      environment: runtime.getSetting("DKG_ENVIRONMENT"),
      endpoint: runtime.getSetting("DKG_HOSTNAME"),
      port: runtime.getSetting("DKG_PORT"),
      blockchain: {
        name: runtime.getSetting("DKG_BLOCKCHAIN_NAME"),
        publicKey: runtime.getSetting("DKG_PUBLIC_KEY"),
        privateKey: runtime.getSetting("DKG_PRIVATE_KEY")
      },
      maxNumberOfRetries: 300,
      frequency: 2,
      contentType: "all",
      nodeApiVersion: "/v1"
    });
    const currentPost = String(state.currentPost);
    elizaLogger.log("currentPost");
    elizaLogger.log(currentPost);
    const userRegex = /From:.*\(@(\w+)\)/;
    let match = currentPost.match(userRegex);
    let twitterUser = "";
    if (match == null ? void 0 : match[1]) {
      twitterUser = match[1];
      elizaLogger.log(`Extracted user: @${twitterUser}`);
    } else {
      elizaLogger.error("No user mention found or invalid input.");
    }
    const idRegex = /ID:\s(\d+)/;
    match = currentPost.match(idRegex);
    let postId = "";
    if (match == null ? void 0 : match[1]) {
      postId = match[1];
      elizaLogger.log(`Extracted ID: ${postId}`);
    } else {
      elizaLogger.log("No ID found.");
    }
    const createDKGMemoryContext = composeContext({
      state,
      template: createDKGMemoryTemplate
    });
    const memoryKnowledgeGraph = await generateObject({
      runtime,
      context: createDKGMemoryContext,
      modelClass: ModelClass.LARGE,
      // @ts-ignore
      schema: DKGMemorySchema
    });
    if (!isDKGMemoryContent(memoryKnowledgeGraph.object)) {
      elizaLogger.error("Invalid DKG memory content generated.");
      throw new Error("Invalid DKG memory content generated.");
    }
    let createAssetResult;
    try {
      elizaLogger.log("Publishing message to DKG");
      createAssetResult = await DkgClient.asset.create(
        {
          public: memoryKnowledgeGraph.object
        },
        { epochsNum: 12 }
      );
      elizaLogger.log("======================== ASSET CREATED");
      elizaLogger.log(JSON.stringify(createAssetResult));
    } catch (error) {
      elizaLogger.error(
        "Error occurred while publishing message to DKG:",
        error.message
      );
      if (error.stack) {
        elizaLogger.error("Stack trace:", error.stack);
      }
      if (error.response) {
        elizaLogger.error(
          "Response data:",
          JSON.stringify(error.response.data, null, 2)
        );
      }
    }
    callback({
      text: `Created a new memory!

Read my mind on @origin_trail Decentralized Knowledge Graph ${DKG_EXPLORER_LINKS[runtime.getSetting("DKG_ENVIRONMENT")]}${createAssetResult == null ? void 0 : createAssetResult.UAL} @${twitterUser}`
    });
    return true;
  },
  examples: [
    [
      {
        user: "{{user1}}",
        content: {
          text: "execute action DKG_INSERT",
          action: "DKG_INSERT"
        }
      },
      {
        user: "{{user2}}",
        content: { text: "DKG INSERT" }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "add to dkg", action: "DKG_INSERT" }
      },
      {
        user: "{{user2}}",
        content: { text: "DKG INSERT" }
      }
    ],
    [
      {
        user: "{{user1}}",
        content: { text: "store in dkg", action: "DKG_INSERT" }
      },
      {
        user: "{{user2}}",
        content: { text: "DKG INSERT" }
      }
    ]
  ]
};

// src/providers/graphSearch.ts
import dotenv2 from "dotenv";
import {
  elizaLogger as elizaLogger2,
  ModelClass as ModelClass2,
  generateObject as generateObject2
} from "@elizaos/core";
import DKG2 from "dkg.js";
dotenv2.config();
var PROVIDER_CONFIG = {
  environment: process.env.DKG_ENVIRONMENT || "testnet",
  endpoint: process.env.DKG_HOSTNAME || "http://default-endpoint",
  port: process.env.DKG_PORT || "8900",
  blockchain: {
    name: process.env.DKG_BLOCKCHAIN_NAME || "base:84532",
    publicKey: process.env.DKG_PUBLIC_KEY || "",
    privateKey: process.env.DKG_PRIVATE_KEY || ""
  },
  maxNumberOfRetries: 300,
  frequency: 2,
  contentType: "all",
  nodeApiVersion: "/v1"
};
async function constructSparqlQuery(runtime, userQuery) {
  const context = `
    You are tasked with generating a SPARQL query to retrieve information from a Decentralized Knowledge Graph (DKG).
    The query should align with the JSON-LD memory template provided below:

    ${JSON.stringify(dkgMemoryTemplate)}

    ** Examples **
    Use the following SPARQL example to understand the format:
    ${combinedSparqlExample}

    ** Instructions **
    1. Analyze the user query and identify the key fields and concepts it refers to.
    2. Use these fields and concepts to construct a SPARQL query.
    3. Ensure the SPARQL query follows standard syntax and can be executed against the DKG.
    4. Use 'OR' logic when constructing the query to ensure broader matching results. For example, if multiple keywords or concepts are provided, the query should match any of them, not all.
    5. Replace the examples with actual terms from the user's query.
    6. Always select distinct results by adding the DISTINCT keyword.
    7. Always select headline and article body. Do not select other fields.

    ** User Query **
    ${userQuery}

    ** Output **
    Provide only the SPARQL query, wrapped in a sparql code block for clarity.
  `;
  const sparqlQueryResult = await generateObject2({
    runtime,
    context,
    modelClass: ModelClass2.LARGE,
    // @ts-ignore
    schema: DKGSelectQuerySchema
  });
  if (!isDKGSelectQuery(sparqlQueryResult.object)) {
    elizaLogger2.error("Invalid SELECT SPARQL query generated.");
    throw new Error("Invalid SELECT SPARQL query generated.");
  }
  return sparqlQueryResult.object.query;
}
var DKGProvider = class {
  client;
  constructor(config) {
    this.validateConfig(config);
  }
  validateConfig(config) {
    const requiredStringFields = ["environment", "endpoint", "port"];
    for (const field of requiredStringFields) {
      if (typeof config[field] !== "string") {
        elizaLogger2.error(
          `Invalid configuration: Missing or invalid value for '${field}'`
        );
        throw new Error(
          `Invalid configuration: Missing or invalid value for '${field}'`
        );
      }
    }
    if (!config.blockchain || typeof config.blockchain !== "object") {
      elizaLogger2.error(
        "Invalid configuration: 'blockchain' must be an object"
      );
      throw new Error(
        "Invalid configuration: 'blockchain' must be an object"
      );
    }
    const blockchainFields = ["name", "publicKey", "privateKey"];
    for (const field of blockchainFields) {
      if (typeof config.blockchain[field] !== "string") {
        elizaLogger2.error(
          `Invalid configuration: Missing or invalid value for 'blockchain.${field}'`
        );
        throw new Error(
          `Invalid configuration: Missing or invalid value for 'blockchain.${field}'`
        );
      }
    }
    this.client = new DKG2(config);
  }
  async search(runtime, message) {
    var _a;
    elizaLogger2.info("Entering graph search provider!");
    const userQuery = message.content.text;
    elizaLogger2.info(`Got user query ${JSON.stringify(userQuery)}`);
    const query = await constructSparqlQuery(runtime, userQuery);
    elizaLogger2.info(`Generated SPARQL query: ${query}`);
    let queryOperationResult = await this.client.graph.query(
      query,
      "SELECT"
    );
    if (!queryOperationResult || !((_a = queryOperationResult.data) == null ? void 0 : _a.length)) {
      elizaLogger2.info(
        "LLM-generated SPARQL query failed, defaulting to basic query."
      );
      queryOperationResult = await this.client.graph.query(
        generalSparqlQuery,
        "SELECT"
      );
    }
    elizaLogger2.info(
      `Got ${queryOperationResult.data.length} results from the DKG`
    );
    const result = queryOperationResult.data.map((entry) => {
      const formattedParts = Object.keys(entry).map(
        (key) => `${key}: ${entry[key]}`
      );
      return formattedParts.join(", ");
    });
    return result.join("\n");
  }
};
var graphSearch = {
  get: async (runtime, _message, _state) => {
    try {
      const provider = new DKGProvider(PROVIDER_CONFIG);
      return await provider.search(runtime, _message);
    } catch (error) {
      elizaLogger2.error("Error in wallet provider:", error);
      return null;
    }
  }
};

// src/actions/index.ts
var actions_exports = {};
__export(actions_exports, {
  dkgInsert: () => dkgInsert
});

// src/providers/index.ts
var providers_exports = {};
__export(providers_exports, {
  DKGProvider: () => DKGProvider,
  graphSearch: () => graphSearch
});

// src/index.ts
var dkgPlugin = {
  name: "dkg",
  description: "Agent DKG which allows you to store memories on the OriginTrail Decentralized Knowledge Graph",
  actions: [dkgInsert],
  providers: [graphSearch]
};
export {
  actions_exports as actions,
  dkgPlugin,
  providers_exports as providers
};
//# sourceMappingURL=index.js.map