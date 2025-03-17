import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";

import { id, solidityPacked, solidityPackedKeccak256, namehash } from "ethers";

// CORS: https://api.thegraph.com/subgraphs/name/ensdomains/ens
const SUBGRAPH_URL = `/api/subgraphs/name/ensdomains/ens`;

function App() {
  const fetchDomain = async () => {
    const result1 = await queryDomainFromId("imtoken.eth");
    const target1 = result1.data.domains[0].owner.domains.find(
      (domain) => domain.name === "op.imtoken.eth"
    );
    console.log(`name1: ${target1?.name}\nowner1: ${target1?.owner.id}`);

    const result2 = await queryDomainFromName("imtoken.eth");
    const target2 = result2.data.domains[0].owner.domains.find(
      (domain) => domain.name === "op.imtoken.eth"
    );
    console.log(`name2: ${target2?.name}\nowner2: ${target2?.owner.id}`);

    const result3 = await queryDomainFromAddress(
      "0x4e88F436422075C1417357bF957764c127B2CC93"
    );
    const target3 = result3.data.domains[0].owner.domains.find(
      (domain) => domain.name === "op.imtoken.eth"
    );
    console.log(`name3: ${target3?.name}\nowner3: ${target3?.owner.id}`);
  };

  interface DomainOwner {
    id: string;
  }

  interface SubDomain {
    name: string;
    owner: DomainOwner;
  }

  interface Domain {
    createdAt: string;
    owner: {
      domains: SubDomain[];
    };
  }

  interface DomainsResponse {
    data: {
      domains: Domain[];
    };
  }

  // Playground:
  // https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fapi.thegraph.com%2Fsubgraphs%2Fname%2Fensdomains%2Fens&query=query+getDomainsForAccount+%7B%0A++domains%28%0A++++where%3A+%7Bid%3A+%220x6996a8ad70089179bc0bf29f3519f65d65359b22bb1c324c32c60020dbffe41c%22%7D%0A++++orderBy%3A+createdAt%0A++++orderDirection%3A+desc%0A++++first%3A+1%0A++%29+%7B%0A++++createdAt%0A++++owner+%7B%0A++++++domains+%7B%0A++++++++name%0A++++++++owner+%7B%0A++++++++++id%0A++++++++%7D%0A++++++%7D%0A++++%7D%0A++%7D%0A%7D%0A
  const queryDomainFromId = async (ens: string = "imtoken.eth") => {
    const name = ens.split(".");
    const nodeEth = namehash(name[1]);
    const idUsername = id(name[0]); // username
    const subnodeUsername = solidityPackedKeccak256(
      ["bytes"],
      [solidityPacked(["bytes32", "bytes32"], [nodeEth, idUsername])]
    );

    const query = `
    query getDomainsForAccount {
  domains(
    where: {id: "${subnodeUsername.toLowerCase()}"}
    orderBy: createdAt
    orderDirection: desc
    first: 1
  ) {
    createdAt
    owner {
      domains {
        name
        owner {
          id
        }
      }
    }
  }
}
`;

    return (await queryGraph(query, SUBGRAPH_URL)) as DomainsResponse;
  };

  // Playground:
  // https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fapi.thegraph.com%2Fsubgraphs%2Fname%2Fensdomains%2Fens&query=query+getDomainsForAccount+%7B%0A++domains%28%0A++++where%3A+%7Bname%3A+%22imtoken.eth%22%7D%0A++++orderBy%3A+createdAt%0A++++orderDirection%3A+desc%0A++++first%3A+1%0A++%29+%7B%0A++++createdAt%0A++++owner+%7B%0A++++++domains+%7B%0A++++++++name%0A++++++++owner+%7B%0A++++++++++id%0A++++++++%7D%0A++++++%7D%0A++++%7D%0A++%7D%0A%7D%0A
  const queryDomainFromName = async (
    ens: string = "imtoken.eth"
  ): Promise<DomainsResponse> => {
    const query = `
    query getDomainsForAccount {
  domains(
    where: {name: "${ens.toLowerCase()}"}
    orderBy: createdAt
    orderDirection: desc
    first: 1
  ) {
    createdAt
    owner {
      domains {
        name
        owner {
          id
        }
      }
    }
  }
}
`;
    return (await queryGraph(query, SUBGRAPH_URL)) as DomainsResponse;
  };

  // Playground:
  // https://cloud.hasura.io/public/graphiql?endpoint=https%3A%2F%2Fapi.thegraph.com%2Fsubgraphs%2Fname%2Fensdomains%2Fens&query=query+getDomainsForAccount+%7B%0A++domains%28%0A++++where%3A+%7Bowner_%3A+%7Bid%3A+%220x4e88f436422075c1417357bf957764c127b2cc93%22%7D%7D%0A++++orderBy%3A+createdAt%0A++++orderDirection%3A+desc%0A++++first%3A+1%0A++%29+%7B%0A++++createdAt%0A++++owner+%7B%0A++++++domains+%7B%0A++++++++name%0A++++++++owner+%7B%0A++++++++++id%0A++++++++%7D%0A++++++%7D%0A++++%7D%0A++%7D%0A%7D%0A
  const queryDomainFromAddress = async (
    address: string = "0x4e88F436422075C1417357bF957764c127B2CC93"
  ): Promise<DomainsResponse> => {
    const query = `
    query getDomainsForAccount {
  domains(
    where: {owner_: {id: "${address.toLowerCase()}"}}
    orderBy: createdAt
    orderDirection: desc
    first: 1
  ) {
    createdAt
    owner {
      domains {
        name
        owner {
          id
        }
      }
    }
  }
}
`;
    return (await queryGraph(query, SUBGRAPH_URL)) as DomainsResponse;
  };

  const queryGraph = async (
    query: string,
    url: string
  ): Promise<any | null> => {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const result = await response.json();

      if (result.errors) {
        throw new Error(`Query failure: ${result.errors}`);
      }
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`Cannot query: ${errorMessage}`);
      return null;
    }
  };

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div>
        <button onClick={fetchDomain}>fetch domain</button>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
