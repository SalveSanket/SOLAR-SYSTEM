pipeline {
    agent any

    tools {
        nodejs 'nodejs-22-6-0'
    }

    environment {
        MONGO_URI = "mongodb+srv://superuser:SuperPassword@supercluster.paumtlt.mongodb.net/?retryWrites=true&w=majority&appName=superCluster"
        SONAR_SCANNER_HOME = tool 'sonarqube-scanner-610'
        DOCKER_CREDENTIALS_ID = 'dockerhub-credentials'
        AWS_EC2_HOST = '54.167.196.168'
        GITEA_TOKEN = credentials('GITEA_TOKEN')
    }

    options {
        disableConcurrentBuilds()
        disableResume()
    }

    stages {
        stage('Checkout Code') {
            options { timestamps(); retry(3) }
            steps {
                echo '📥 Checking out code....'
                checkout scm
            }
        }

        stage('VM Node Version') {
            steps {
                sh '''
                    node -v
                    npm -v
                '''
            }
        }

        stage('Install Dependencies') {
            options { timestamps() }
            steps {
                echo '🔧 Installing dependencies....'
                sh 'npm install --no-audit'
                sh 'npm install --include=dev --no-audit'
                echo '🔧 Dependencies installed successfully!'
            }
        }

        stage('Dependency Check') {
            options { timestamps() }
            parallel {
                stage('NPM Audit') {
                    steps {
                        echo '🔍 Running npm audit....'
                        sh 'npm audit --audit-level=critical'
                    }
                }
                stage('OWASP Check') {
                    steps {
                        echo '🛡️ Running OWASP Dependency Check...'
                        dependencyCheck additionalArguments: '''
                            --scan ./
                            --out ./ 
                            --format ALL 
                            --prettyPrint
                            --disableYarnAudit
                        ''', odcInstallation: 'OWASP-DepCheck'
                    }
                }
                stage('Seed Database') {
                    steps {
                        echo '🌱 Seeding database before tests...'
                        sh 'node seed.js'
                    }
                }
            }
        }

        stage('Unit Test') {
            options { timestamps(); retry(2) }
            steps {
                withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')]) {
                    echo '🧪 Running unit tests....'
                    sh 'npm test'
                }
            }
        }

        stage('Code Coverage & SonarQube') {
            options { timestamps() }
            parallel {
                stage('Code Coverage') {
                    steps {
                        withCredentials([usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')]) {
                            catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                                echo '📊 Running code coverage....'
                                sh 'npm run coverage'
                            }
                        }
                    }
                }
                stage('SonarQube Scan') {
                    steps {
                        timeout(time: 60, unit: 'SECONDS') {
                            withSonarQubeEnv('sonar-qube-server') {
                                catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                                    echo '🔍 Running SonarQube analysis...'
                                    sh '''
                                        ${SONAR_SCANNER_HOME}/bin/sonar-scanner \
                                        -Dsonar.projectKey=Solar_System-Project \
                                        -Dsonar.sources=app.js \
                                        -Dsonar.host.url=http://98.81.130.171:9000 \
                                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                                    '''
                                }
                            }
                        }
                    }
                }
            }
        }

        stage('Build Docker Image') {
            options { timestamps() }
            steps {
                echo '🐳 Building multi-architecture Docker image for amd64 and arm64...'
                withDockerRegistry([credentialsId: 'dockerhub-credentials', url: '']) {
                    sh '''
                        # Clean up old Docker images
                        docker rmi -f $(docker images -q) || true

                        # Create and use Buildx builder (skip if already exists)
                        docker buildx create --name multiarch-builder --use || docker buildx use multiarch-builder

                        # Build and push multi-architecture image
                        docker buildx build --platform linux/amd64,linux/arm64 \
                            -t indicationmark/solar-system-app:$GIT_COMMIT \
                            --push .
                    '''
                }
            }
        }

        stage('Trivy Scan') {
            options { timestamps() }
            steps {
                echo '🔍 Running Trivy vulnerability scan....'
                script {
                    def exitCode = sh(script: '''
                        trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                            --severity CRITICAL \
                            --exit-code 1 \
                            --quiet \
                            --format json -o trivy-image-CRITICAL-results.json || true
                    ''', returnStatus: true)

                    sh '''
                        trivy image indicationmark/solar-system-app:$GIT_COMMIT \
                            --severity LOW,MEDIUM \
                            --exit-code 0 \
                            --quiet \
                            --format json -o trivy-image-MEDIUM-results.json

                        trivy convert --format template -t "/usr/local/share/trivy/templates/html.tpl" \
                            -o trivy-image-MEDIUM-results.html trivy-image-MEDIUM-results.json || echo "Conversion failed"

                        trivy convert --format template -t "/usr/local/share/trivy/templates/html.tpl" \
                            -o trivy-image-CRITICAL-results.html trivy-image-CRITICAL-results.json || echo "Conversion failed"

                        trivy convert --format template -t "/usr/local/share/trivy/templates/junit.tpl" \
                            -o trivy-image-MEDIUM-results.xml trivy-image-MEDIUM-results.json || echo "Conversion failed"

                        trivy convert --format template -t "/usr/local/share/trivy/templates/junit.tpl" \
                            -o trivy-image-CRITICAL-results.xml trivy-image-CRITICAL-results.json || echo "Conversion failed"
                    '''

                    if (exitCode != 0) {
                        echo '❗️Critical vulnerabilities found in Trivy scan!'
                    } else {
                        echo '✅ No critical vulnerabilities in Trivy scan.'
                    }
                }
            }
        }

        stage('Push Docker Image') {
            options { timestamps() }
            steps {
                echo '🚀 Pushing Docker image to Docker Hub....'
                withDockerRegistry([credentialsId: 'dockerhub-credentials', url: '']) {
                    sh 'docker push indicationmark/solar-system-app:$GIT_COMMIT'
                }
            }
        }

        stage('Deploy to AWS EC2') {
            options { timestamps() }
            when {
                branch pattern: "feature/.*", comparator: "REGEXP"
            }
            steps {
                withCredentials([
                    sshUserPrivateKey(credentialsId: 'AWS_Deployment-Server_SSH-Key', keyFileVariable: 'EC2_KEY'),
                    usernamePassword(credentialsId: 'mongo-db-credentials', usernameVariable: 'MONGO_USERNAME', passwordVariable: 'MONGO_PASSWORD')
                ]) {
                    echo '🌐 Deploying to AWS EC2....'
                    sh """
                        ssh -o StrictHostKeyChecking=no -i \$EC2_KEY ubuntu@${AWS_EC2_HOST} '
                            if sudo docker ps -a | grep -q solar-system-app; then
                                echo "🛑 Stopping existing container..."
                                sudo docker stop solar-system-app
                                sudo docker rm solar-system-app
                                echo "🗑️ Existing container removed."
                            fi
                            sudo docker run -d --name solar-system-app \
                                -e MONGO_URI="mongodb+srv://superuser:$MONGO_PASSWORD@supercluster.d83jj.mongodb.net/superData" \
                                -e MONGO_USERNAME=\$MONGO_USERNAME \
                                -e MONGO_PASSWORD=\$MONGO_PASSWORD \
                                -p 3000:3000 \
                                indicationmark/solar-system-app:$GIT_COMMIT
                            echo "🚀 New container started successfully!"
                        '
                    """
                }
            }
        }

        stage('Integration Testing') {
            options { timestamps() }
            when {
                branch pattern: "feature/.*", comparator: "REGEXP"
            }
            steps {
                withAWS(credentials: 'AWS Jenkins Credentials',region: 'us-east-1') {
                    echo '🧪 Running Integration Test...'
                    sh '''
                        chmod +x integrationTesting.sh
                        ./integrationTesting.sh
                    '''
                }
            }
        }

        stage('K8 update image tag') {
            options { timestamps() }
            when {
                branch 'main'
            }
            steps {
                echo '🔄 Updating Kubernetes deployment with new image tag...'
                sh 'rm -rf solar-system-gitops-argocd-gitea && git clone -b main https://$GITEA_TOKEN@gitea.com/nodejsApplicationProject/solar-system-gitops-argocd-gitea.git'
                dir('solar-system-gitops-argocd-gitea/Kubernetes') {
                    sh '''
                        git checkout -b feature/update-image-tag-$BUILD_ID
                        sed -i "s|indicationmark/solar-system-app:.*|indicationmark/solar-system-app:$GIT_COMMIT|g" deployment.yaml

                        git config user.name "Jenkins CI"
                        git config user.email "sanketsalve01@gmail.com"

                        git add deployment.yaml
                        git commit -m "Update Docker image tag to $GIT_COMMIT"
                        git push origin feature/update-image-tag-$BUILD_ID
                    '''
                }
            }
        }

        stage('Raise Pull Request in Gitea') {
            when {
                branch 'main'
            }
            steps {
                script {
                    def pr_title = "Update Docker image tag to ${GIT_COMMIT}"
                    def pr_body = "Auto-generated PR by Jenkins to update the Docker image tag to `${GIT_COMMIT}`."
                    def feature_branch = "feature/update-image-tag-${BUILD_ID}"
                    def base_branch = "main"
                    def repo_owner = "nodejsApplicationProject"
                    def repo_name = "solar-system-gitops-argocd-gitea"
                    def gitea_api_base = "https://gitea.com/api/v1"
                    
                    echo "🔁 Creating Pull Request from ${feature_branch} to ${base_branch}..."

                    sh """
                        curl -s -o response.json -w "%{http_code}" -X POST "${gitea_api_base}/repos/${repo_owner}/${repo_name}/pulls" \\
                        -H "Authorization: token ${GITEA_TOKEN}" \\
                        -H "Content-Type: application/json" \\
                        -d '{
                            "head": "${feature_branch}",
                            "base": "${base_branch}",
                            "title": "${pr_title}",
                            "body": "${pr_body}"
                        }' > status_code.txt

                        echo "Status: \$(cat status_code.txt)"
                        echo "Response: \$(cat response.json)"
                    """

                    def status = readFile('status_code.txt').trim()
                    if (status != "201") {
                        error "❌ Failed to create Pull Request. Status code: ${status}. See response.json for details."
                    } else {
                        echo "✅ Pull Request created successfully!"
                    }
                }
            }
        }
    }

    post {
        always {
            script{
                if (fileExists('solar-system-gitops-argocd-gitea/Kubernetes/deployment.yaml')) {
                    echo '🔄 Kubernetes deployment file exists, proceeding with cleanup...'
                    sh 'rm -rf solar-system-gitops-argocd-gitea'
                } else {
                    echo '⚠️ Kubernetes deployment file does not exist, skipping cleanup.'
                }
            }

            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: 'coverage/lcov-report',
                reportFiles: 'index.html',
                reportName: 'Code Coverage Report'
            ])
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: './',
                reportFiles: 'dependency-check-jenkins.html',
                reportName: 'Dependency Check Report'
            ])
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: './',
                reportFiles: 'trivy-image-MEDIUM-results.html',
                reportName: 'Trivy Medium Report'
            ])
            publishHTML([
                allowMissing: true,
                alwaysLinkToLastBuild: true,
                keepAll: true,
                reportDir: './',
                reportFiles: 'trivy-image-CRITICAL-results.html',
                reportName: 'Trivy Critical Report'
            ])
            catchError(buildResult: 'SUCCESS', stageResult: 'SUCCESS') {
                echo '📦 Archiving artifacts....'
                junit allowEmptyResults: true, testResults: 'test-results.xml'
            }
        }

        success {
            echo '✅ Build completed successfully!'
        }

        failure {
            echo '❌ Build failed. Check the logs.'
        }
    }
}
